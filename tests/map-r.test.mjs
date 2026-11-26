import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {MapRenderer,defaultCamera,layout,position} from '../dist/map.mjs';
import {parseCSV,normalizeRows,detectColumns,groupSites,csvEncode,decodeTerrarium,siteCatalog,withSiteIds} from '../dist/core.mjs';
import {MARKER_SHAPES} from '../dist/markers.mjs';
import {createMapPackage} from '../dist/codegen.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),qa=path.join(root,'qa/map-r-checks');await fs.mkdir(qa,{recursive:true});
const native=createRequire(import.meta.url)(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'));
globalThis.Path2D=native.Path2D;globalThis.document={createElement:()=>native.createCanvas(1,1)};
globalThis.fetch=async url=>new Response(await fs.readFile(path.join(root,'dist',url)));
const renderer=new MapRenderer(document.createElement('canvas'),()=>{});await renderer.init();
for(const key of ['1/0/0','1/0/1','1/1/0','1/1/1']){const [z,x,y]=key.split('/').map(Number),img=await native.loadImage(path.join(root,'dist/assets/terrain',key+'.png')),c=native.createCanvas(256,256),cx=c.getContext('2d');cx.drawImage(img,0,0);const data=cx.getImageData(0,0,256,256).data;renderer.terrain.tiles.set(key,{key,z,x,y,status:'ready',elev:Float32Array.from({length:65536},(_,i)=>decodeTerrarium(...data.subarray(i*4,i*4+3)))});}
// Make any unexpected geographic download a test failure.
renderer.terrain.request=key=>{const tile=renderer.terrain.tiles.get(key);if(!tile)throw Error('Unbundled tile requested: '+key);return tile;};
const labels=MARKER_SHAPES.map((s,i)=>i===0?'001':i===1?'Species "quoted" 漢字':s);
const rows=[['lat','lon','species'],...labels.map((name,i)=>[-50+25*Math.floor(i/5),-140+(i%5)*65,name]),[10,120,labels[0]],[10,120,labels[1]],[10,120,labels[1]],[10,120,labels[2]],[24.123456789,121.123456789,'Excluded']];
const raw=parseCSV(csvEncode(rows)),columns=detectColumns(raw.headers),{valid}=normalizeRows(raw,columns),groups=[...labels,'Excluded'],selected=new Set(labels);
const settings={mapScope:'world',projection:'mercator',terrain:true,terrainQuality:'auto',hillshade:false,shadow:.28,direction:315,angle:45,ecologyTheme:'off',countries:true,countryLabels:true,counties:false,towns:false,ocean:true,bathymetry:true,isobaths:true,freshwater:true,legend:true,legendTitle:'species',legendFont:13,legendSymbol:5,radius:10,autoSize:true,frame:true,grid:true,northArrow:true,scaleBar:true,pies:true,pieMode:'count',digits:5,siteNumbers:true,siteLabelSize:11,pageWidth:25,pageHeight:20};
const siteList=withSiteIds(groupSites(valid.filter(p=>selected.has(p.group)),5,'count',true),siteCatalog(valid,settings),true);
const state={settings,raw,columns,filename:'lat-lon-species.csv',valid,invalid:[],groups,selected,sites:siteList,language:'en',demo:true,referenceBounds:[-180,-80,180,80],camera:defaultCamera(settings,[-180,-80,180,80]),colors:Object.fromEntries(groups.map(g=>[g,'#0072b2'])),shapes:Object.fromEntries(labels.map((g,i)=>[g,MARKER_SHAPES[i]])),displayNames:{'001':'Taxon 001'},legendEdits:{taxa:{font:10,italic:true,title:'Exported taxa'}}};
for(let i=0;i<300&&!renderer.status(state).ready;i++)await new Promise(r=>setTimeout(r,20));assert.ok(renderer.status(state).ready);
const runner=process.env.WORLDBIO_RSCRIPT||path.join(root,'qa/codegen-r/Rscript');await fs.access(runner);
let first;
for(const projection of ['mercator','equalEarth','robinson']){
 const s={...settings,projection,terrainQuality:projection==='equalEarth'?'fast':'auto'},scene={...state,settings:s,camera:defaultCamera(s,[-180,-80,180,80],projection==='mercator'?undefined:150)};
 for(let i=0;i<300&&!renderer.status(scene).ready;i++)await new Promise(r=>setTimeout(r,20));assert.ok(renderer.status(scene).ready);
 const bundle=createMapPackage(scene,renderer,{width:1500});
 assert.ok(bundle.scene.commands.some(d=>d.type==='gradient'),'Depth uses a continuous gradient');
 assert.ok(bundle.scene.commands.some(d=>d.layer==='legend-elevation'));
 assert.ok(bundle.scene.commands.some(d=>d.layer==='legend-taxa'&&d.taxon==='001'&&d.type==='marker'));
 assert.ok(bundle.scene.commands.some(d=>d.layer==='demo'));
 assert.equal(Object.keys(bundle.scene.shapes).length,MARKER_SHAPES.length-1);
 const table=parseCSV(bundle.points);assert.equal(table.rows.length,labels.length+3);assert.ok(!table.rows.flat().includes('Excluded'));
 assert.equal(table.rows.filter(r=>r[2]==='120'&&r[3]==='10').reduce((n,r)=>n+Number(r[8]),0),4,'Count-weighted pie data retained');
 const folder=path.join(qa,projection);await fs.mkdir(folder,{recursive:true});for(const f of bundle.files)await fs.writeFile(path.join(folder,f.name),f.data);
 const web=renderer.render(scene,{canvas:document.createElement('canvas'),width:1500}).canvas;await fs.writeFile(path.join(folder,'canvas-reference.png'),web.toBuffer('image/png'));
 const log=execFileSync(runner,[path.join(folder,'map.R')],{cwd:root,encoding:'utf8',timeout:60000});
 const output=(await fs.readdir(path.join(folder,'output'))).sort().at(-1),out=path.join(folder,'output',output);assert.ok((await fs.stat(path.join(out,'map.pdf'))).size>10000);assert.ok((await fs.stat(path.join(out,'map.svg'))).size>10000);
 const img=await native.loadImage(path.join(out,'map.png'));assert.equal(img.width,1500);assert.equal(img.height,1200);
 const actual=native.createCanvas(img.width,img.height);actual.getContext('2d').drawImage(img,0,0);
 const a=actual.getContext('2d').getImageData(0,0,img.width,img.height).data,b=web.getContext('2d').getImageData(0,0,img.width,img.height).data;
 let close=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])<24)close++;
 assert.ok(close/(img.width*img.height)>.94,'R reproduces the visible fixed-view map, with font/antialias differences');
 console.log('PASS:',projection,'real R PNG/PDF/SVG;',Math.round(close/(img.width*img.height)*10000)/100+'% matching pixels');
 if(!first)first={folder,bundle,scene};
}
// Mutating taxa.csv drives BOTH map and legend; package data is never evaluated.
const taxa=parseCSV(first.bundle.taxa);taxa.rows[0][1]='#ef1234';taxa.rows[0][2]='star5';taxa.rows[0][3]='R edited label';
await fs.writeFile(path.join(first.folder,'taxa.csv'),csvEncode([taxa.headers,...taxa.rows]));
let r=first.bundle.script.replace('point_scale = 1,','point_scale = 1.5,').replace('show_legends = TRUE,','show_legends = FALSE,').replace('output_pixels = 1500,','output_pixels = 1000,');
await fs.writeFile(path.join(first.folder,'edited.R'),r);execFileSync(runner,[path.join(first.folder,'edited.R')],{encoding:'utf8',timeout:60000});
const editedOut=(await fs.readdir(path.join(first.folder,'output'))).sort().at(-1),editedImage=await native.loadImage(path.join(first.folder,'output',editedOut,'map.png'));assert.equal(editedImage.width,1000);
const editedCanvas=native.createCanvas(1000,800);editedCanvas.getContext('2d').drawImage(editedImage,0,0);const q=position(-140,-50,first.scene.camera,layout(first.scene.settings),first.scene.settings),pixel=editedCanvas.getContext('2d').getImageData(Math.round(q[0]*1000/1200),Math.round(q[1]*1000/1200),1,1).data;
assert.ok(pixel[0]>200&&pixel[1]<50&&pixel[2]<100,'Edited taxon color is used by the actual R point renderer');
const noLegend=editedCanvas.getContext('2d').getImageData(805,40,190,700).data;assert.ok([...noLegend].every(n=>n===255),'Legend-off removes the actual legend output');
// Header-only points/taxa work for a basemap-only export, including no legend command.
const empty={...state,settings:{...settings,legend:false,terrain:false,ocean:false,bathymetry:false,isobaths:false,freshwater:false,pageWidth:20,pageHeight:25},groups:[],selected:new Set(),sites:[]};
const emptyBundle=createMapPackage(empty,renderer,{width:800}),folder=path.join(qa,'empty');await fs.mkdir(folder,{recursive:true});for(const f of emptyBundle.files)await fs.writeFile(path.join(folder,f.name),f.data);
execFileSync(runner,[path.join(folder,'map.R')],{encoding:'utf8',timeout:60000});
const emptyOut=(await fs.readdir(path.join(folder,'output'))).sort().at(-1),emptyImage=await native.loadImage(path.join(folder,'output',emptyOut,'map.png'));assert.equal(emptyImage.width,800);assert.equal(emptyImage.height,1000);
console.log('PASS: real R style/size/legend changes and empty-data portrait basemap output');
