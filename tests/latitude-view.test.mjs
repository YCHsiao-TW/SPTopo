import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {boundedMercatorCamera,mercatorBounds} from '../dist/longitude.mjs';
import {MapRenderer,defaultCamera,layout} from '../dist/map.mjs';
import {WORLD_REGIONS,polarGaps} from '../dist/world.mjs';
import {PAGE_PRESETS} from '../dist/page.mjs';
for(const [pageWidth,pageHeight] of Object.values(PAGE_PRESETS)){
 const s={pageWidth,pageHeight,legend:true},p=layout(s);
 for(const y of [-1,0,.5,1,2])for(const zoom of [1,3,10]){
  const camera=boundedMercatorCamera({x:.5,y,zoom},p),b=mercatorBounds(camera,p);
  assert.ok(b[1]>=-85-1e-9&&b[3]<=85+1e-9);assert.ok(256*2**camera.zoom>=p.w-1e-9);assert.ok(polarGaps(camera,p).every(g=>g.h<1e-8));
  assert.deepEqual(boundedMercatorCamera(camera,p),camera,'clamp is stable');
 }
}
const require=createRequire(import.meta.url),native=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'));
globalThis.Path2D=native.Path2D;globalThis.document={createElement:()=>native.createCanvas(256,256)};
const root=path.resolve('dist');globalThis.fetch=async url=>new Response(await fs.readFile(path.resolve(root,url)));
const canvas=document.createElement('canvas'),renderer=new MapRenderer(canvas,()=>{});await renderer.init();
const settings={mapScope:'world',terrain:false,legend:true,frame:true,counties:false,towns:false,countries:true},p=layout(settings),camera=boundedMercatorCamera(defaultCamera(settings,WORLD_REGIONS.world),p);
const result=renderer.render({settings,camera,sites:[],groups:[],colors:{},language:'zh-Hant'},{svg:true});
assert.ok(!result.svg.includes('data-layer="polar-coverage"'),'no polar stripe in SVG');assert.ok(!result.svg.includes('85°N 以外'));assert.ok(!result.svg.includes('85°S 以外'));
await fs.writeFile('docs/sptopo-latitude-view.png',canvas.toBuffer('image/png'));
console.log('PASS: frame fill, 85-degree bounds, zoom-out and pole panning across aspect presets; native Canvas/SVG without polar stripes');
