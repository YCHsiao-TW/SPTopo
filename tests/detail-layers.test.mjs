import {FreshwaterLayers,readFreshwaterTile,tileKeys} from '../dist/freshwater.mjs';
import assert from 'node:assert/strict';
import {DetailLayers} from '../dist/detail-layers.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const empty={type:'FeatureCollection',features:[]};
const index={overview:'overview.json',tiles:Object.fromEntries(Array.from({length:8},(_,i)=>[i,{bbox:[i,0,i+1,1],file:i+'.json'}]))};
let calls=[],waiting=[],failIndex=false;
globalThis.fetch=async url=>{calls.push(url);if(url.endsWith('index.json'))return new Response(JSON.stringify(failIndex?{}:index));return await new Promise(resolve=>waiting.push({url,resolve}));};
const layer=new DetailLayers('test',()=>{}),camera={zoom:6};assert.ok(layer.status(true,camera,[0,0,4,1]).pending);await tick();layer.status(true,camera,[0,0,4,1]);assert.equal(layer.running,3);
layer.status(true,camera,[6,0,8,1]);assert.ok(!layer.queue.includes('3.json'),'Stale pending geometry files cancelled');
for(let i=0;i<8;i++){const batch=waiting;waiting=[];batch.forEach(w=>w.resolve(new Response(JSON.stringify(empty))));await tick();}
assert.ok(layer.status(true,camera,[6,0,8,1]).ready);const count=calls.length;layer.status(true,camera,[6,0,8,1]);assert.equal(calls.length,count,'Loaded region reuses cache');
assert.deepEqual(layer.plan({zoom:2},[6,0,8,1]),['overview.json']);assert.deepEqual(layer.plan(camera,[6,0,8,1],true),['overview.json']);assert.equal(layer.data({zoom:2},null),null);
layer.status(true,{zoom:2},null,false,{request:false});assert.equal(calls.length,count,'Read-only/export inspection starts no fetch');
layer.status(true,{zoom:2},null);waiting.shift().resolve(new Response('',{status:503}));await tick();assert.ok(layer.status(true,{zoom:2},null).failed);const failedCalls=calls.length;layer.status(true,{zoom:2},null);assert.equal(calls.length,failedCalls,'No automatic retry loop');layer.retry();layer.status(true,{zoom:2},null);waiting.shift().resolve(new Response(JSON.stringify(empty)));await tick();assert.ok(layer.status(true,{zoom:2},null).ready);
for(let i=0;i<70;i++)layer.files.set('unused-'+i,{state:'ready',data:empty});layer.prune();assert.ok(layer.files.size<=24);
failIndex=true;const bad=new DetailLayers('broken',()=>{});bad.status(true,camera,[0,0,1,1]);await tick();assert.ok(bad.status(true,camera,[0,0,1,1]).failed);failIndex=false;bad.retry();bad.status(true,camera,[0,0,1,1]);await tick();bad.status(true,camera,[0,0,1,1]);waiting.shift().resolve(new Response(JSON.stringify(empty)));await tick();assert.ok(bad.status(true,camera,[0,0,1,1]).ready);
const wrapped=tileKeys([179,-1,181,1],4);
assert.ok(wrapped.includes('4/179_44')&&wrapped.includes('4/0_44'));
assert.equal(wrapped.length,new Set(wrapped).size);
const hydro=new FreshwaterLayers(()=>{});hydro.index=index;
assert.deepEqual(hydro.selection([-180,-85,180,85],4),{level:0,files:['overview.json']});
const line={type:'LineString',arcs:[0,1],properties:{style:'river'}};
const lake={type:'Polygon',arcs:[[2],[3]],properties:{style:'area'}};
const tile={type:'Topology',transform:{scale:[.5,.5],translate:[0,0]},
 objects:{freshwater:{type:'GeometryCollection',geometries:[line,lake]}},
 arcs:[[[0,0],[2,0]],[[2,0],[2,0]],[[0,0],[8,0],[0,8],[-8,0],[0,-8]],[[2,2],[0,4],[4,0],[0,-4],[-4,0]]]};
const features=readFreshwaterTile(tile).features;
assert.deepEqual(features[0].geometry.coordinates,[[0,0],[1,0],[2,0]]);
assert.deepEqual(features[1].bbox,[0,0,4,4]);assert.equal(features[1].geometry.coordinates.length,2);
const {arcs,...header}=tile,metadata=new TextEncoder().encode(JSON.stringify(header));
const bytes=[83,80,87,49,metadata.length&255,metadata.length>>8,0,0,...metadata,arcs.length];
for(const arc of arcs){bytes.push(2,arc.length);for(const [x,y] of arc)for(const value of [x/2,y/2])bytes.push(value>=0?2*value:-2*value-1);}
const packed=Uint8Array.from(bytes);
assert.deepEqual(readFreshwaterTile(packed).features,features,'Packed tiles decode with the per-arc coordinate scale');
assert.throws(()=>readFreshwaterTile(packed.subarray(0,-1)),/Invalid freshwater arc/);
console.log('PASS: lazy indices, regional planning, bounded concurrency/cache, stale queue removal, retries, wrap and joined tile arcs');
