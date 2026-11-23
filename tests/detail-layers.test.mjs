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
const hydro=new DetailLayers('hydro-detail',()=>{});hydro.index=index;hydro.indexState='ready';const a={bbox:[0,0,2,1],geometry:{},properties:{kind:'lakes',id:3}},b={...a,properties:{kind:'lakes',id:4}};hydro.files.set('0.json',{state:'ready',data:{features:[a]}});hydro.files.set('1.json',{state:'ready',data:{features:[a,b]}});assert.equal(hydro.data(camera,[0,0,2,1]).features.length,2,'Whole lake geometries are deduplicated across intersecting tiles');
console.log('PASS: lazy indices, current-region planning, bounded concurrency/cache, stale queue removal, overview projections, explicit retry, read-only exports and lake deduplication');
