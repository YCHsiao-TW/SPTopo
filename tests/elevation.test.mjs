import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {RAMP,WORLD_RAMP,rampColor,project} from '../dist/core.mjs';
import {elevationScale,WORLD_REGIONS} from '../dist/world.mjs';
import {MapRenderer,layout,defaultCamera,position} from '../dist/map.mjs';
import {pngBlob,pdfBlob} from '../dist/export.mjs';

assert.equal(RAMP.at(-1)[0],4000);
assert.equal(WORLD_RAMP.at(-1)[0],9000);
for(let e=0;e<=4000;e+=25)assert.deepEqual(rampColor(e,WORLD_RAMP),rampColor(e),'Low-elevation colors stay unchanged');
assert.equal(new Set([4000,4500,5000,6000,7000,8000,9000].map(e=>rampColor(e,WORLD_RAMP).join(','))).size,7,'High mountains have distinct colors');
assert.deepEqual(rampColor(12000,WORLD_RAMP),[255,255,255]);
assert.deepEqual(rampColor(9000),rampColor(4000));
const settings={terrain:true,legend:true,hillshade:false,shadow:.28,direction:315,angle:45,terrainQuality:'auto',radius:7,italic:true,frame:true,countries:true};
const taiwanCamera=defaultCamera(settings,[119.5,21.6,122.25,25.55]),worldCamera=defaultCamera(settings,WORLD_REGIONS.world);
assert.equal(elevationScale().max,9000);

const require=createRequire(import.meta.url),native=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'):'@napi-rs/canvas');
globalThis.Path2D=native.Path2D;
globalThis.document={createElement(){const c=native.createCanvas(1,1);c.toBlob=cb=>cb(new Blob([c.toBuffer('image/png')],{type:'image/png'}));return c;}};
globalThis.fetch=async url=>new Response(await fs.readFile(new URL('../dist/'+url,import.meta.url)));
const canvas=document.createElement('canvas'),renderer=new MapRenderer(canvas,()=>{});await renderer.init();await renderer.terrain.ready;
// A synthetic 6000 m tile tests the full palette without an upstream request.
const xy=project(121,23.5),z=6,x=Math.floor(xy[0]*2**z),y=Math.floor(xy[1]*2**z),key=`${z}/${x}/${y}`;
const tile={z,x,y,key,status:'ready',elev:new Float32Array(65536).fill(6000)};
renderer.terrain.tiles.set(key,tile);renderer.terrain.visible=()=>({z,tiles:[tile],placements:[{key:tile.key,x:tile.x,y:tile.y}]});
const base={settings,language:'en',camera:taiwanCamera,groups:[],selected:new Set(),colors:{},sites:[],demo:true};
const out=new URL('../qa/',import.meta.url);await fs.mkdir(out,{recursive:true});
for(const width of [1200,3000]){
 const scene=base,scale=width/1200;
 const result=renderer.render(scene,{width,svg:true}),[px,py]=position(121,23.5,scene.camera,layout(scene.settings));
 const pixel=[...canvas.getContext('2d').getImageData(Math.round(px*scale),Math.round(py*scale),1,1).data];
 const expected=rampColor(6000,WORLD_RAMP);
 assert.deepEqual(pixel,[...expected,255],`The regional view uses the full palette at ${width}px`);
 const sea=position(120,24,scene.camera,layout(scene.settings));
 assert.deepEqual([...canvas.getContext('2d').getImageData(Math.round(sea[0]*scale),Math.round(sea[1]*scale),1,1).data],[255,255,255,255],'Sea stays outside the terrain mask');
 assert.ok(result.svg.includes('>9000</text>'));
 assert.ok(result.svg.includes('>4000</text>'));
 assert.ok((await pngBlob(canvas,'Elevation scale QA')).size>1000);
 assert.ok(pdfBlob(canvas,'Elevation scale QA').size>1000);
 if(width===1200){await fs.writeFile(new URL(`elevation-world.png`,out),canvas.toBuffer('image/png'));await fs.writeFile(new URL(`elevation-world.svg`,out),result.svg);}
}
for(const camera of [worldCamera,taiwanCamera]){
 const result=renderer.render({...base,camera},{svg:true});
 assert.ok(result.svg.includes('>9000</text>'),'The legend remains fixed as the map extent changes');
}
console.log('PASS: unchanged lowland colors, distinct 4000–9000 m colors, the same scale at global and regional extents, Canvas/SVG legends and 1200/3000px PNG/PDF exports');
