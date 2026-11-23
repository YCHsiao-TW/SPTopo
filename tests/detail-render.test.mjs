import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {MapRenderer,defaultCamera,position,layout,mapSource} from '../dist/map.mjs';
import {projector} from '../dist/projection.mjs';
import {createMapPackage} from '../dist/codegen.mjs';
import {pngBlob,pdfBlob,zipBlob} from '../dist/export.mjs';
const native=createRequire(import.meta.url)(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'));
globalThis.Path2D=native.Path2D;globalThis.document={createElement:()=>{const c=native.createCanvas(1,1);c.toBlob=f=>f(new Blob([c.toBuffer('image/png')],{type:'image/png'}));return c;}};
const requests=[];globalThis.fetch=async url=>{requests.push(url);return new Response(await fs.readFile(new URL('../dist/'+url,import.meta.url)));};
const renderer=new MapRenderer(document.createElement('canvas'),()=>{});await renderer.init();await renderer.water.load('bathymetry');
const landRing=[[120,20],[120,40],[130,40],[130,20],[120,20]],lakeRing=[[122,28],[122,32],[126,32],[126,28],[122,28]];
const coast={type:'FeatureCollection',features:[{type:'Feature',bbox:[120,20,130,40],properties:{kind:'land'},geometry:{type:'Polygon',coordinates:[landRing]}},{type:'Feature',bbox:[120,20,130,40],properties:{kind:'coast'},geometry:{type:'LineString',coordinates:landRing}}]};
const hydro={type:'FeatureCollection',features:[{type:'Feature',bbox:[122,28,126,32],properties:{kind:'lakes',id:1},geometry:{type:'Polygon',coordinates:[lakeRing]}},{type:'Feature',bbox:[121,22,128,24],properties:{kind:'rivers',id:2,rank:1},geometry:{type:'LineString',coordinates:[[121,22],[128,24]]}}]};
for(const [loader,data] of [[renderer.coastDetail,coast],[renderer.hydroDetail,hydro]]){loader.index={overview:'overview.json',tiles:{test:{bbox:[-180,-85,180,85],file:'region.json'}}};loader.indexState='ready';for(const name of ['overview.json','region.json'])loader.files.set(name,{state:'ready',data});}
const settings={basemap:'terrain',coastDetail:true,waterDetail:true,projection:'mercator',mapScope:'world',terrain:false,ocean:true,rivers:true,lakes:true,countries:true,counties:false,towns:false,legend:false,frame:true,grid:false,northArrow:true,scaleBar:true,pageWidth:25,pageHeight:20,radius:7,digits:5,pieMode:'presence'};
const raw={headers:['lon','lat','species'],rows:[['124','34','Taxon A']]};
const state={settings,camera:defaultCamera(settings,[115,15,135,45]),referenceBounds:[115,15,135,45],language:'en',raw,columns:{lon:'lon',lat:'lat',group:'species'},valid:[{lon:124,lat:34,group:'Taxon A',line:2,row:raw.rows[0]}],groups:['Taxon A'],selected:new Set(['Taxon A']),sites:[{lon:124,lat:34,values:[{group:'Taxon A',value:1,count:1}],count:1}],colors:{'Taxon A':'#d55e00'},shapes:{},legendEdits:{},displayNames:{},demo:false};
for(const projection of ['mercator','equalEarth','robinson']){
 settings.projection=projection;const curved=projection!=='mercator';state.camera=defaultCamera(settings,curved?[-180,-70,180,70]:state.referenceBounds);
 assert.ok(renderer.status(state).ready);const output=document.createElement('canvas'),result=renderer.render(state,{canvas:output,width:1200,svg:true});assert.match(result.svg,/OpenStreetMap contributors/);assert.match(result.svg,/RiverATLAS/);assert.match(result.svg,/data-layer="lakes"/);assert.equal(renderer.water.layers.size,1,'Detailed rivers/lakes do not also download old freshwater vectors');
 const p=layout(settings),point=curved?projector(settings,state.camera,p):(lon,lat)=>position(lon,lat,state.camera,p,settings),pixel=q=>{const [x,y]=point(...q);return [...output.getContext('2d').getImageData(Math.round(x),Math.round(y),1,1).data].slice(0,3);};
 await fs.writeFile(new URL('../qa/detail-fixture-'+projection+'.png',import.meta.url),output.toBuffer('image/png'));const land=pixel([128,37]),sea=pixel([117,35]),lake=pixel([124,30]);assert.ok(land[0]>210&&land[1]>230&&land[2]<240,projection+' custom land mask');assert.ok(sea[2]>sea[0],projection+' ocean follows the same coast mask');assert.ok(lake[2]>lake[0]+25,projection+' detailed lake fill');
 await fs.writeFile(new URL('../qa/detail-fixture-'+projection+'.png',import.meta.url),output.toBuffer('image/png'));assert.ok((await pngBlob(output,mapSource(state))).size>1000);assert.ok(pdfBlob(output,mapSource(state)).size>1000);
 const pack=createMapPackage(state,renderer,{width:1200});assert.ok(pack.scene.commands.some(d=>d.layer==='attribution'&&d.text?.includes('RiverATLAS')));assert.match(pack.scene.source,/CC BY 4.0/);assert.ok((await zipBlob(pack.files)).size>10000);const im=await native.loadImage(pack.files.find(f=>f.name==='basemap.png').data);assert.equal(im.width,1200);
}
state.settings.projection='mercator';state.camera=defaultCamera(settings,state.referenceBounds);renderer.hydroDetail.files.delete('region.json');renderer.hydroDetail.files.delete('overview.json');const before=requests.length;assert.throws(()=>renderer.render(state,{canvas:document.createElement('canvas'),width:3000}),/尚未載入完成/);assert.equal(requests.length,before,'Incomplete export cannot fetch a larger region');
console.log('PASS: matching land/ocean mask, independent detailed rivers/lakes, true coastlines, all three projections, no legends, PNG/SVG/PDF/R attribution and no export amplification');
