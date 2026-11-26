import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {MapRenderer,layout,defaultCamera,position,inversePosition,mapSource} from '../dist/map.mjs';
import {projected,projector,anchorCamera} from '../dist/projection.mjs';
import {project,unproject,rampColor,WORLD_RAMP,decodeTerrarium} from '../dist/core.mjs';
const native=createRequire(import.meta.url)(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'));
globalThis.Path2D=native.Path2D;globalThis.document={createElement(){return native.createCanvas(1,1);}};
globalThis.fetch=async url=>new Response(await fs.readFile(new URL('../dist/'+url,import.meta.url)));
const base={mapScope:'world',projection:'equalEarth',terrain:false,legend:true,legendFont:13,legendSpecies:true,legendTitle:'species',countries:true,counties:false,towns:false,radius:7,autoSize:false,frame:true,grid:true,scaleBar:true,hillshade:false,shadow:.28,direction:315,angle:45,terrainQuality:'auto'};
for(const projection of ['equalEarth','robinson'])for(const center of [0,150,-170]){
 const s={...base,projection},p=layout(s),camera=defaultCamera(s,[-180,-80,180,80],center),point=projector(s,camera,p);
 assert.equal(projected(s,camera,p),true);assert.ok(point.domain().length>20);
 for(const q of [[121,24],[179,35],[-179,-35],[-74,40],[0,75],[0,-80],[150,0]]){const screen=position(...q,camera,p,s),back=inversePosition(...screen,camera,p,s);assert.ok(Math.abs(back[0]-q[0])<.0001&&Math.abs(back[1]-q[1])<.0001,projection+' round trip '+q);}
 assert.equal(point.invert(-1000,-1000),null);
 const anchor=[((center+20+180)%360+360)%360-180,-20],before=point(...anchor),zoomed=anchorCamera(s,camera,p,anchor,before,camera.zoom+1.5);assert.ok(Math.hypot(...projector(s,zoomed,p)(...anchor).map((n,i)=>n-before[i]))<.1,'Zoom keeps geographic anchor');
 const target=before.map((n,i)=>n+(i?34:92)),panned=anchorCamera(s,camera,p,anchor,target);assert.ok(Math.hypot(...projector(s,panned,p)(...anchor).map((n,i)=>n-target[i]))<.1,'Drag keeps geographic anchor');
}
const localBounds=[119.5,21.6,122.25,25.55],localCamera=defaultCamera(base,localBounds),localPlot=layout(base);
const localPoint=position(121,24,localCamera,localPlot,base);
assert.equal(projected(base),true);
assert.ok(Math.hypot(...inversePosition(...localPoint,localCamera,localPlot,base).map((n,i)=>n-[121,24][i]))<.0001);
assert.notDeepEqual(localPoint,position(121,24,defaultCamera({...base,projection:'mercator'},localBounds),localPlot));
const pac=defaultCamera(base,[-180,-80,180,80],150),pp=layout(base),pacpoint=projector(base,pac,pp);assert.ok(Math.abs(pacpoint(179,0)[0]-pacpoint(-179,0)[0])<pp.w*.02,'Dateline points are adjacent in Pacific view');
const state={settings:base,camera:pac,language:'en',sites:[],groups:['Species A'],selected:new Set(['Species A']),colors:{'Species A':'#ec426a'},shapes:{},legendEdits:{},displayNames:{},demo:false};
const canvas=document.createElement('canvas'),renderer=new MapRenderer(canvas,()=>{});await renderer.init();
// Deterministic geographic DEM checks the independently projected terrain pixels.
renderer.terrain.request=key=>{if(renderer.terrain.tiles.has(key))return renderer.terrain.tiles.get(key);const [z,x,y]=key.split('/').map(Number),n=2**z,elev=new Float32Array(65536);for(let j=0;j<256;j++)for(let i=0;i<256;i++)elev[j*256+i]=((x+(i+.5)/256)/n)*5000+((y+(j+.5)/256)/n)*500;const t={key,z,x,y,elev,status:'ready'};renderer.terrain.tiles.set(key,t);return t;};
for(const projection of ['equalEarth','robinson']){
 const s={...base,projection,terrain:true,legend:false,grid:false,frame:false,countries:false,scaleBar:false},scene={...state,settings:s,camera:defaultCamera(s,[-180,-80,180,80],150)};
 assert.ok(renderer.status(scene).ready);const out=renderer.render(scene,{svg:true});assert.ok(out.svg.includes(projection==='equalEarth'?'Equal Earth (equal area)':'Robinson (compromise)'));assert.ok(!out.svg.includes('EPSG:3857'));
 for(const q of [[100,42],[-100,40],[15,2]]){const xy=position(...q,scene.camera,layout(s),s),uv=project(...q),expected=rampColor(uv[0]*5000+uv[1]*500,WORLD_RAMP),actual=canvas.getContext('2d').getImageData(Math.round(xy[0]),Math.round(xy[1]),1,1).data;assert.ok(expected.every((v,i)=>Math.abs(v-actual[i])<14),`Reprojected DEM at ${q}: ${actual} vs ${expected}`);}
 await fs.writeFile(new URL('../qa/projection-'+projection+'.png',import.meta.url),canvas.toBuffer('image/png'));
}
// Real bundled terrain and source water polygons exercise ocean/lake winding.
for(const key of ['1/0/0','1/0/1','1/1/0','1/1/1']){const [z,x,y]=key.split('/').map(Number),img=await native.loadImage(new URL('../dist/assets/terrain/'+key+'.png',import.meta.url).pathname),cv=native.createCanvas(256,256),ctx=cv.getContext('2d');ctx.drawImage(img,0,0);const d=ctx.getImageData(0,0,256,256).data;renderer.terrain.tiles.set(key,{key,z,x,y,status:'ready',elev:Float32Array.from({length:65536},(_,i)=>decodeTerrarium(...d.subarray(i*4,i*4+3)))});}
for(const projection of ['equalEarth','robinson']){
 const settings={...base,projection,terrain:true,terrainQuality:projection==='equalEarth'?'fast':'auto',bathymetry:true,ocean:true,freshwater:true,isobaths:true,grid:false},scene={...state,settings,camera:defaultCamera(settings,[-180,-80,180,80],150)};
 renderer.status(scene);for(let i=0;i<300&&!renderer.status(scene).ready;i++)await new Promise(r=>setTimeout(r,20));assert.ok(renderer.status(scene).ready);assert.equal(renderer.status(scene).z,1);
 const out=renderer.render(scene,{svg:true});for(const layer of ['bathymetry','isobaths','freshwater'])assert.ok(out.svg.includes('data-layer="'+layer+'"'));
 const pixel=q=>{const xy=position(...q,scene.camera,layout(settings),settings);return [...canvas.getContext('2d').getImageData(Math.round(xy[0]),Math.round(xy[1]),1,1).data];};
 const sea=pixel([170,0]),land=pixel([100,42]),lake=pixel([-87,44]);assert.ok(sea[2]>sea[0]+20&&sea[0]<160,'Actual Pacific depth stays blue');assert.ok(land[0]>land[2]+10,'Water does not overpaint land');assert.ok(lake[2]>lake[0]+20,'Source lake remains blue in projected view');
 await fs.writeFile(new URL('../qa/projection-water-'+projection+'.png',import.meta.url),canvas.toBuffer('image/png'));
}
console.log('PASS: projected globes, inverse coordinates, Pacific seam, anchored pan/zoom, DEM, and projected ocean and OSM freshwater layers');
