import assert from 'node:assert/strict';
import {openApp} from './support/app-fixture.mjs';
import {layout,position} from '../dist/map.mjs';
import {wrapUnit,eastwardBounds} from '../dist/longitude.mjs';
const app=await openApp(),{get,savedConfig,loadConfig,flush}=app;
get('region').value='bering';await get('region').emit('change');let cfg=await savedConfig();assert.deepEqual(cfg.referenceBounds,[165,50,-145,73]);
for(const [id,value] of Object.entries({west:170,east:-160,south:55,north:73}))get(id).value=String(value);
await get('applyBounds').emit('click');cfg=await savedConfig();assert.deepEqual(cfg.referenceBounds,[170,55,-160,73]);
get('west').value='180';get('east').value='-180';await get('applyBounds').emit('click');assert.deepEqual(await savedConfig(),cfg);
for(const x of [.001,.999]){
 const initial={...cfg,camera:{...cfg.camera,x}};await loadConfig(initial);const p=layout(cfg.settings),key=x<.5?'ArrowLeft':'ArrowRight',delta=(x<.5?-1:1)*p.w*.1/(256*2**cfg.camera.zoom);
 await get('map').emit('keydown',{key});const moved=await savedConfig();assert.ok(Math.abs(moved.camera.x-wrapUnit(x+delta))<1e-10);
 await loadConfig(initial);await get('map').emit('pointerdown',{clientX:600,clientY:400,pointerId:1});await get('map').emit('pointermove',{clientX:600+(x<.5?100:-100),clientY:400,pointerId:1});await get('map').emit('pointerup');const dragged=await savedConfig();assert.ok(x<.5?dragged.camera.x>.9:dragged.camera.x<.1);
 await loadConfig(dragged);assert.deepEqual(await savedConfig(),dragged);
}
await app.loadCSV('synthetic-bering.csv','longitude,latitude,species\n179,66,Example\n-179,66,Example\n');await get('fitBtn').emit('click');await flush();cfg=await savedConfig();const p=layout(cfg.settings),a=position(179,66,cfg.camera,p),b=position(-179,66,cfg.camera,p);
assert.ok(cfg.referenceBounds[0]>cfg.referenceBounds[2]);assert.ok(eastwardBounds(cfg.referenceBounds)[2]-cfg.referenceBounds[0]<3);assert.ok(a[0]>=p.x&&b[0]<=p.x+p.w&&b[0]>a[0]);
await get('saveProject').emit('click');const project=await app.downloads.at(-1).blob.text();await get('resetBtn').emit('click');get('projectFile').files=[app.file('bering.tbm.json',project)];await get('projectFile').emit('change');await flush();assert.deepEqual(await savedConfig(),cfg);
console.log('PASS: preset, manual bounds, invalid bounds, keyboard/drag wrapping, CSV fit and project round-trip');
