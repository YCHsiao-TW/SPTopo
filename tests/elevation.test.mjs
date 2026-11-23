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
const plot=layout(settings),taiwanCamera=defaultCamera(settings),worldCamera=defaultCamera(settings,WORLD_REGIONS.world);
for(const [mapScope,camera,max] of [['auto',taiwanCamera,4000],['auto',worldCamera,9000],['taiwan',worldCamera,4000],['world',taiwanCamera,9000]])assert.equal(elevationScale({...settings,mapScope},camera,plot).max,max);

const require=createRequire(import.meta.url),native=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'):'@napi-rs/canvas');
globalThis.Path2D=native.Path2D;
globalThis.document={createElement(){const c=native.createCanvas(1,1);c.toBlob=cb=>cb(new Blob([c.toBuffer('image/png')],{type:'image/png'}));return c;}};
globalThis.fetch=async url=>new Response(await fs.readFile(new URL('../dist/'+url,import.meta.url)));
const canvas=document.createElement('canvas'),renderer=new MapRenderer(canvas,()=>{});await renderer.init();await renderer.terrain.ready;
// Synthetic 6000 m land exercises both palettes on the very same DEM tile.
// This isolates scale selection and stale-cache failures from upstream DEMs.
const xy=project(121,23.5),z=6,x=Math.floor(xy[0]*2**z),y=Math.floor(xy[1]*2**z),key=`${z}/${x}/${y}`;
const tile={z,x,y,key,status:'ready',elev:new Float32Array(65536).fill(6000)};
renderer.terrain.tiles.set(key,tile);renderer.terrain.visible=()=>({z,tiles:[tile],placements:[{key:tile.key,x:tile.x,y:tile.y}]});
const base={settings,language:'en',camera:taiwanCamera,groups:[],selected:new Set(),colors:{},sites:[],demo:true};
const out=new URL('../qa/',import.meta.url);await fs.mkdir(out,{recursive:true});
for(const width of [1200,3000])for(const mapScope of ['world','taiwan','world']){
 const scene={...base,settings:{...settings,mapScope}},scale=width/1200;
 const result=renderer.render(scene,{width,svg:true}),[px,py]=position(121,23.5,scene.camera,layout(scene.settings));
 const pixel=[...canvas.getContext('2d').getImageData(Math.round(px*scale),Math.round(py*scale),1,1).data];
 const expected=rampColor(6000,mapScope==='world'?WORLD_RAMP:RAMP);
 assert.deepEqual(pixel,[...expected,255],`${mapScope} at ${width}px uses its palette after a mode switch`);
 const sea=position(120,24,scene.camera,layout(scene.settings));
 assert.deepEqual([...canvas.getContext('2d').getImageData(Math.round(sea[0]*scale),Math.round(sea[1]*scale),1,1).data],[255,255,255,255],'Local world/Taiwan sea stays outside the terrain mask');
 assert.equal(result.svg.includes('>9000</text>'),mapScope==='world');
 assert.ok(result.svg.includes('>4000</text>'));
 assert.ok((await pngBlob(canvas,'Elevation scale QA')).size>1000);
 assert.ok(pdfBlob(canvas,'Elevation scale QA').size>1000);
 if(width===1200){await fs.writeFile(new URL(`elevation-${mapScope}.png`,out),canvas.toBuffer('image/png'));await fs.writeFile(new URL(`elevation-${mapScope}.svg`,out),result.svg);}
}
for(const [camera,max] of [[taiwanCamera,4000],[worldCamera,9000],[taiwanCamera,4000]]){
 const result=renderer.render({...base,camera,settings:{...settings,mapScope:'auto'}},{svg:true});
 assert.equal(result.svg.includes('>9000</text>'),max===9000,'Auto mode legend follows the actual basemap');
}
console.log('PASS: unchanged lowland colors, distinct 4000–9000 m colors, automatic/explicit scales, same-tile cache switching, Canvas/SVG legends and 1200/3000px PNG/PDF exports');
