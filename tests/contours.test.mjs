import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {isolines,sampleDEM} from '../dist/contours.mjs';
import {MapRenderer,defaultCamera} from '../dist/map.mjs';
import {WORLD_REGIONS} from '../dist/world.mjs';
const p={x:0,y:0,w:10,h:10};
assert.deepEqual(isolines([0,1000,0,1000],2,2,p,500),[{level:500,d:'M5.00,0.00L5.00,10.00'},{level:1000,d:'M10.00,0.00L10.00,10.00'}]);
assert.equal(isolines([0,1000,NaN,1000],2,2,p,500).length,0);
assert.equal(isolines([-100,0,-100,0],2,2,p,500).length,0);
assert.equal((isolines([0,1000,1000,0],2,2,p,500)[0].d.match(/M/g)||[]).length,2);
const constant=new Map([['0/0/0',{status:'ready',elev:new Float32Array(65536).fill(123)}]]);
assert.equal(sampleDEM(constant,0,180,0),123);assert.equal(sampleDEM(constant,0,-180,0),123);assert.ok(Number.isNaN(sampleDEM(constant,0,0,89)));
const require=createRequire(import.meta.url),native=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'));
globalThis.Path2D=native.Path2D;globalThis.Image=native.Image;globalThis.document={createElement:()=>native.createCanvas(256,256)};
const root=path.resolve('dist');globalThis.fetch=async url=>new Response(await fs.readFile(path.resolve(root,url)));
const canvas=document.createElement('canvas'),renderer=new MapRenderer(canvas,()=>{});await renderer.init();process.chdir(root);
const settings={mapScope:'world',terrain:false,landContours:true,contourInterval:500,terrainQuality:'auto',legend:true,countries:false};
const state={settings,camera:defaultCamera(settings,WORLD_REGIONS.world),sites:[],groups:[],selected:new Set(),colors:{},language:'en'};
for(let i=0;i<100&&!renderer.status(state).ready;i++)await new Promise(r=>setTimeout(r,30));
assert.ok(renderer.status(state).ready,'DEM loads when fill is off');
// Analytic DEM fixtures keep all projection/zoom coverage independent of external tile servers.
renderer.terrain.request=key=>{let t=renderer.terrain.tiles.get(key);if(t?.status==='ready')return t;const [z,x,y]=key.split('/').map(Number),elev=new Float32Array(65536);for(let j=0;j<256;j++)for(let i=0;i<256;i++)elev[j*256+i]=1800+1600*Math.sin((x*256+i)/(256*2**z)*Math.PI*4)*Math.cos((y*256+j)/(256*2**z)*Math.PI*2);t={key,z,x,y,elev,status:'ready'};renderer.terrain.tiles.set(key,t);return t;};

for(const projection of ['mercator','equalEarth','robinson']){
 const s={...state,settings:{...settings,projection}};s.camera=defaultCamera(s.settings,WORLD_REGIONS.world);
 for(let i=0;i<100&&!renderer.status(s).ready;i++)await new Promise(r=>setTimeout(r,30));
 const result=renderer.render(s,{svg:true});assert.ok(result.svg.includes('data-layer="land-contours"'));assert.ok(result.svg.includes('clip-path="url(#land-contours)"'));assert.ok(renderer.landContours.result.every(c=>!c.d.includes('NaN')));
 const labelTexts=[...result.svg.matchAll(/>([0-9]+ m)<\/text>/g)].map(m=>m[1]);assert.ok(labelTexts.length>0,'contour height labels exported');
 if(projection==='mercator'){await fs.writeFile(path.resolve(root,'../docs/sptopo-contour-labels.png'),canvas.toBuffer('image/png'));}
 const cached=renderer.landContours.result;const large=renderer.render(s,{width:2400,svg:true});assert.deepEqual([...large.svg.matchAll(/>([0-9]+ m)<\/text>/g)].map(m=>m[1]),labelTexts,'labels match across export sizes');assert.equal(renderer.landContours.result,cached,'export resolution preserves logical geometry');
 const off=renderer.render({...s,settings:{...s.settings,landContours:false}},{svg:true});assert.ok(!off.svg.includes('data-layer="land-contours"'));
}
renderer.render(state,{svg:true});const first=renderer.landContours.result;renderer.render({...state,settings:{...settings,contourInterval:1000}},{svg:true});assert.notEqual(renderer.landContours.result,first);
const tile=renderer.status(state).tiles[0],elev=tile.elev;renderer.terrain.request=key=>renderer.terrain.tiles.get(key);tile.status='pending';assert.equal(renderer.status(state).ready,false);assert.throws(()=>renderer.render(state,{svg:true}),/載入/);tile.status='ready';tile.elev=new Float32Array(elev);renderer.render(state,{svg:true});assert.notEqual(renderer.landContours.result,first);
console.log('PASS: contours interpolation, missing/negative data, saddle, dateline, DEM-only loading, three projections, SVG clipping, export geometry, toggle, interval, cache and pending-export guard');
