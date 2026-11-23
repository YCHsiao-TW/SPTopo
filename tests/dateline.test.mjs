import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {dataBounds,groupSites} from '../dist/core.mjs';
import {eastwardBounds,geographicOverlap,mercatorBounds,tilePlacements,wrapLongitude} from '../dist/longitude.mjs';
import {MapRenderer,Terrain,layout,defaultCamera,position,inversePosition,mercatorPoint} from '../dist/map.mjs';
import {WORLD_REGIONS,isClippedEdge,outlineGeometry} from '../dist/world.mjs';
import {streetTilePlan} from '../dist/street-map.mjs';
import {DetailLayers} from '../dist/detail-layers.mjs';
import {viewportSummary} from '../dist/viewport-summary.mjs';
import {mapPointRows,occurrenceCSV} from '../dist/codegen.mjs';
import {pngBlob,pdfBlob} from '../dist/export.mjs';
const settings={mapScope:'world',projection:'mercator',legend:false,terrain:true,terrainQuality:'auto',hillshade:true,shadow:.28,direction:315,angle:45,countries:true,frame:true,grid:false,radius:7,digits:5,pieMode:'presence'};
const p=layout(settings),camera=defaultCamera(settings,WORLD_REGIONS.bering);
const records=[[179,66],[-179,66],[170,66],[-165,65]].map(([lon,lat],i)=>({lon,lat,group:'Example',line:i+2}));
const original=structuredClone(records),bounds=dataBounds(records.slice(0,2)),b=eastwardBounds(bounds);
assert.ok(bounds[0]>bounds[2]&&b[2]-b[0]<3,'Fit uses the short arc');
const equivalent=eastwardBounds(dataBounds([{lon:180,lat:65},{lon:-180,lat:65}]));assert.ok(equivalent[2]-equivalent[0]<1);
assert.deepEqual(records,original);
for(const c of [camera,{...camera,x:0},{...camera,x:.9999}]){
 const a=position(179,66,c,p),b=position(-179,66,c,p);assert.ok(Math.abs(b[0]-a[0]-256*2**c.zoom*2/360)<1e-7);
 for(const lon of [179,-179,180,-180]){const q=inversePosition(...position(lon,66,c,p),c,p);assert.ok(Math.abs(wrapLongitude(q[0]-lon))<1e-7&&Math.abs(q[1]-66)<1e-7);}
 const plan=streetTilePlan(c,p);assert.ok(plan.keys.length<=48&&plan.keys.length===new Set(plan.keys).size);
 const placements=tilePlacements(c,p,4),xs=placements.map(t=>Number(t.key.split('/')[1]));assert.ok(xs.includes(0)&&xs.includes(15));assert.ok(placements.some(t=>t.x<0||t.x>=16));
}
assert.equal(tilePlacements({x:.5,y:.5,zoom:1},p,19,120),null,'Reject an excessive tile allocation before creating arrays');
const view=mercatorBounds(camera,p);assert.ok(geographicOverlap([165,50,180,73],view)&&geographicOverlap([-180,50,-145,73],view));assert.equal(geographicOverlap([-5,50,5,73],view),false);
const detail=new DetailLayers('coast-detail',()=>{});detail.index={overview:'overview.json',tiles:{east:{bbox:[165,50,180,73],file:'east.json'},west:{bbox:[-180,50,-145,73],file:'west.json'},zero:{bbox:[-5,50,5,73],file:'zero.json'}}};assert.deepEqual(detail.plan({...camera,zoom:5},view),['east.json','west.json']);
assert.ok(isClippedEdge([-180,65.067],[-179.999951171875,68.983]));assert.equal(isClippedEdge([179.9,65],[179.8,68]),false);
const require=createRequire(import.meta.url),native=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'));
globalThis.Path2D=native.Path2D;globalThis.Image=native.Image;globalThis.document={createElement(){const c=native.createCanvas(1,1);c.toBlob=fn=>fn(new Blob([c.toBuffer('image/png')],{type:'image/png'}));return c;}};
const dist=new URL('../dist/',import.meta.url);globalThis.fetch=async url=>new Response(await fs.readFile(new URL(url,dist)));process.chdir(dist.pathname);
const canvas=document.createElement('canvas'),renderer=new MapRenderer(canvas,()=>{});await renderer.init();renderer.terrain.visible=function(c,plot){return Terrain.prototype.visible.call(this,c,plot,1);};
const state={settings,camera,sites:groupSites(records),valid:records,groups:['Example'],selected:new Set(['Example']),colors:{Example:'#ff0000'},language:'en',demo:true};
for(let i=0;i<100&&!renderer.status(state).ready;i++)await new Promise(resolve=>setTimeout(resolve,20));assert.ok(renderer.status(state).ready);
const sample=(lon,lat,width)=>{const [x,y]=position(lon,lat,camera,p);return [...canvas.getContext('2d').getImageData(Math.round(x*width/1200),Math.round(y*width/1200),1,1).data];};
for(const width of [1200,3000]){
 renderer.render({...state,sites:[]},{width});
 for(const lon of [179.9,-179.9,170,-165]){const color=sample(lon,66,width);assert.ok(color[1]<250&&color[1]>50,`Land terrain at ${lon}: ${color}`);}
 assert.ok(sample(179,56,width).slice(0,3).every(v=>v===255),'No false land polygon across the sea');
 const left=sample(179.99,67,width),right=sample(-179.99,67,width);assert.ok(left.slice(0,3).every((v,i)=>Math.abs(v-right[i])<15),`DEM joins at 180: ${left} / ${right}`);
 const result=renderer.render(state,{width,svg:true});assert.equal(renderer.hitMarkers.length,4);assert.equal(viewportSummary(state).inside,4);assert.equal(mapPointRows(state).length,5);
 for(const {x,y} of renderer.hitMarkers){const px=canvas.getContext('2d').getImageData(Math.round(x*width/1200),Math.round(y*width/1200),1,1).data;assert.ok(px[0]>230&&px[1]<30);}
 for(const match of result.svg.matchAll(/>(-?[\d.]+)°<\/text>/g))assert.ok(Math.abs(Number(match[1]))<=180,'Normalized tick labels');
 assert.ok(occurrenceCSV(records).includes('"-179"'));assert.ok((await pngBlob(canvas,'Bering',{widthCm:25,heightCm:20})).size>1000);assert.ok(pdfBlob(canvas,'Bering',{widthCm:25,heightCm:20}).size>1000);
 if(width===1200){await fs.mkdir(new URL('../qa/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../qa/bering-terrain.png',import.meta.url),canvas.toBuffer('image/png'));}
}
for(const row of mapPointRows(state).slice(1)){const marker=renderer.hitMarkers.find(m=>m.site.lon===row[2]);assert.ok(Math.abs(row[4]-marker.x)<1e-7&&Math.abs(row[5]-marker.y)<1e-7);}
const russia=renderer.world.features.find(f=>f.properties.iso==='RUS'),d=outlineGeometry(russia.geometry,mercatorPoint(camera,p)),seam=position(180,67,camera,p)[0];let last;
for(const m of d.matchAll(/([ML])(-?[\d.]+),(-?[\d.]+)/g)){const q=[Number(m[2]),Number(m[3])];if(m[1]==='L'&&last)assert.ok(!(Math.abs(q[0]-seam)<.01&&Math.abs(last[0]-seam)<.01&&Math.abs(q[1]-last[1])>15),'No artificial dateline border');last=q;}
console.log('PASS: circular fit, bidirectional display/inverse, tile wrapping, detail selection, actual Bering land/DEM, PNG/SVG/PDF and R positions at 1200/3000 px');
