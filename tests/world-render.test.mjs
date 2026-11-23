import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {MapRenderer,defaultCamera,position,layout} from '../dist/map.mjs';
import {WORLD_REGIONS} from '../dist/world.mjs';
import {groupSites} from '../dist/core.mjs';
import {pngBlob,pdfBlob} from '../dist/export.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),require=createRequire(import.meta.url),native=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'):'@napi-rs/canvas');
globalThis.Path2D=native.Path2D;globalThis.document={createElement(){const c=native.createCanvas(256,256);c.toBlob=fn=>fn(new Blob([c.toBuffer('image/png')],{type:'image/png'}));return c;}};
globalThis.fetch=async url=>new Response(await fs.readFile(path.resolve(root,'dist',url)));
const canvas=document.createElement('canvas'),renderer=new MapRenderer(canvas,()=>{});await renderer.init();
const settings={mapScope:'world',terrain:false,legend:true,legendTitle:'species',radius:7,autoSize:false,italic:true,frame:true,grid:true,countries:true,countryLabels:true,counties:false,towns:false,northArrow:true,scaleBar:true,pies:true,digits:5,pieMode:'presence'};
const points=[[121.56,25.03],[139.69,35.68],[151.21,-33.87],[2.35,48.86],[-74.01,40.71],[18.42,-33.93],[-70.67,-33.45],[178.45,-18.14],[-171.75,-13.83]].map(([lon,lat])=>({lon,lat,group:'Species A'}));
const state={settings,language:'en',camera:defaultCamera(settings,WORLD_REGIONS.world),sites:groupSites(points),groups:['Species A'],selected:new Set(['Species A']),colors:{'Species A':'#ff0000'},demo:true};
const result=renderer.render(state,{width:1500,svg:true});assert.equal(renderer.hitMarkers.length,9);assert.ok(result.svg.includes('Natural Earth'));assert.ok(result.svg.includes('stroke="#64745c"'));
const p=layout(settings),q=position(151.21,-33.87,state.camera,p),scale=1500/1200,pixel=canvas.getContext('2d').getImageData(Math.round(q[0]*scale),Math.round(q[1]*scale),1,1).data;assert.ok(pixel[0]>230&&pixel[1]<30,'Sydney marker visible over world land');
const out=path.join(root,'qa');await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'world-map.png'),canvas.toBuffer('image/png'));await fs.writeFile(path.join(out,'world-map.svg'),result.svg);
assert.ok((await pngBlob(canvas,'World DEMO',{widthCm:25,heightCm:20})).size>1000);assert.ok(pdfBlob(canvas,'World DEMO',{widthCm:25,heightCm:20}).size>1000);
const noBorders=renderer.render({...state,settings:{...settings,countries:false,countryLabels:false}},{svg:true});assert.ok(!noBorders.svg.includes('stroke="#64745c"'),'Country toggle removes internal boundaries while retaining land');assert.ok(noBorders.svg.includes('stroke="#657c54"'));
for(const [name,bounds] of Object.entries(WORLD_REGIONS)){const r=renderer.render({...state,camera:defaultCamera(settings,bounds)},{width:1200,svg:true});assert.ok(r.svg.includes('<svg'));if(name==='oceania')assert.ok(renderer.hitMarkers.some(m=>m.site.lat<0));}
console.log('PASS: actual world/continent Canvas and SVG renders, all 9 hemispheric/dateline markers, country toggle, Natural Earth source metadata and PNG/PDF generation');

// The initial global view uses four bundled z1 DEMs, with no remote request.
globalThis.Image=native.Image;process.chdir(path.join(root,'dist'));
const terrainState={...state,settings:{...settings,terrain:true,terrainQuality:'auto',hillshade:true,shadow:.28,direction:315,angle:45}};
for(let i=0;i<100&&!renderer.status(terrainState).ready;i++)await new Promise(resolve=>setTimeout(resolve,30));
assert.equal(renderer.status(terrainState).ready,true,renderer.status(terrainState).message);
assert.equal(renderer.status(terrainState).tiles.length,4);
const terrainMap=renderer.render(terrainState,{width:1500,svg:true});
assert.ok(terrainMap.svg.includes('>9000</text>'));
await fs.writeFile(path.join(out,'world-terrain.png'),canvas.toBuffer('image/png'));
await fs.writeFile(path.join(out,'world-terrain.svg'),terrainMap.svg);
console.log('PASS: bundled global DEM loading, actual world terrain and 9000 m legend');
