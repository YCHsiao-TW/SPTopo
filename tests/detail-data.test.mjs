import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {MapRenderer,defaultCamera,position,layout} from '../dist/map.mjs';
import {parseCSV,detectColumns,normalizeRows,groupSites} from '../dist/core.mjs';
import {createMapPackage} from '../dist/codegen.mjs';
const native=createRequire(import.meta.url)(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'));
globalThis.Path2D=native.Path2D;globalThis.document={createElement:()=>native.createCanvas(1,1)};
const requests=[];globalThis.fetch=async url=>{requests.push(url);return new Response(await fs.readFile(new URL('../dist/'+url,import.meta.url)));};
const renderer=new MapRenderer(document.createElement('canvas'),()=>{});await renderer.init();
async function ready(s){for(let i=0;i<500;i++){const q=renderer.status(s);if(q.failed)throw Error(JSON.stringify(q));if(q.ready)return;await new Promise(r=>setTimeout(r,20));}throw Error('Detail timeout');}
for(const folder of ['coast-detail','freshwater']){
 const root=new URL('../dist/assets/'+folder+'/',import.meta.url),index=JSON.parse(await fs.readFile(new URL('index.json',root),'utf8'));assert.ok(index.source);assert.ok(Object.keys(index.tiles).length>100);assert.ok((await fs.stat(new URL(index.overview,root))).size<4e6);
 for(const entry of Object.values(index.tiles)){assert.ok(entry.bbox.length===4&&entry.bbox.every(Number.isFinite));assert.ok((await fs.stat(new URL(entry.file,root))).size<5e6,'Bounded per-region payload');}
}
const raw=parseCSV('lat,lon,species\n24.47449,118.38679,Kinmen record'),columns=detectColumns(raw.headers),{valid}=normalizeRows(raw,columns);
const settings={coastDetail:true,projection:'mercator',terrain:false,ocean:true,freshwater:true,countries:false,legend:false,frame:true,grid:false,northArrow:true,scaleBar:true,pageWidth:25,pageHeight:20,radius:7,pies:true,digits:5,pieMode:'presence'};
const state={settings,language:'en',camera:defaultCamera(settings,[118.1,24.35,118.52,24.57]),referenceBounds:[118.1,24.35,118.52,24.57],raw,columns,valid,groups:['Kinmen record'],selected:new Set(['Kinmen record']),sites:[],colors:{'Kinmen record':'#0072b2'},shapes:{},legendEdits:{},displayNames:{},demo:false};
for(const [name,bounds,projection] of [['kinmen',[118.1,24.35,118.52,24.57],'mercator'],['taiwan',[119.3,21.5,122.5,25.7],'mercator'],['great-lakes',[-94,40,-72,50],'mercator'],['world-equalEarth',[-180,-80,180,80],'equalEarth'],['world-robinson',[-180,-80,180,80],'robinson']]){
 settings.projection=projection;state.camera=defaultCamera(settings,bounds,projection==='mercator'?undefined:150);await ready(state);
 const output=document.createElement('canvas'),result=renderer.render(state,{canvas:output,width:1500,svg:true});assert.match(result.svg,/Overture Maps/);assert.match(result.svg,/OpenStreetMap contributors/);assert.ok(!/NaN|Infinity/.test(result.svg.replace(/data:image\/[^" ]+/g,'')),name+': finite SVG coordinates (excluding encoded raster bytes)');assert.equal(renderer.water.layers.size,0,'Detailed freshwater and plain ocean need no legacy water vectors');
 const p=layout(settings),data=renderer.freshwater.visible(settings,state.camera,p);if(name==='taiwan'){assert.ok(data.features.filter(f=>f.properties.kind==='river').length>50,'Taiwan river coverage added');assert.ok(data.features.some(f=>['lake','reservoir'].includes(f.properties.kind)),'Taiwan lakes present');}
 if(name==='great-lakes')assert.ok(data.features.some(f=>['lake','reservoir'].includes(f.properties.kind)),'Large lake geometry retained');
 if(name==='kinmen'){
  const ctx=output.getContext('2d');
  const pixel=(lon,lat)=>{const [x,y]=position(lon,lat,state.camera,p,settings);return [...ctx.getImageData(Math.round(x*1.25),Math.round(y*1.25),1,1).data];};
  const land=pixel(118.38679,24.47449),sea=pixel(118.33,24.51);
  assert.ok(land[0]>210&&land[1]>230&&land[2]<240,'The specimen coordinate is on OSM land');
  assert.notDeepEqual(land,sea,'The nearby strait uses a distinct ocean fill');
  assert.doesNotMatch(result.svg,/local-boundaries|Taiwan Atlas/);
 }
 await fs.writeFile(new URL('../qa/detail-actual-'+name+'.png',import.meta.url),output.toBuffer('image/png'));
 if(name==='taiwan'){state.sites=groupSites(valid,5,'presence',true);const pack=createMapPackage(state,renderer,{width:1500});const folder=new URL('../qa/detail-r-package/',import.meta.url);await fs.mkdir(folder,{recursive:true});for(const f of pack.files)await fs.writeFile(new URL(f.name,folder),f.data);assert.ok(pack.scene.commands.filter(c=>c.layer==='attribution'&&c.type==='text').length===1);state.sites=[];}
 const before=requests.length;renderer.render(state,{canvas:document.createElement('canvas'),width:3000});assert.equal(requests.length,before,'More pixels do not request a different geographic detail plan');
}
console.log('PASS: real OSM Kinmen land, Taiwan rivers/lakes, Great Lakes, Pacific-centered Equal Earth/Robinson, bounded asset files, attributed R package and stable high-resolution export source');
