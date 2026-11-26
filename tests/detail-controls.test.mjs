import assert from 'node:assert/strict';
import {openApp} from './support/app-fixture.mjs';
import {MapRenderer} from '../dist/map.mjs';
import {effectiveMapSettings} from '../dist/basemap-settings.mjs';

const {get,savedConfig,loadConfig,flush,downloads,rendered}=await openApp();
const initial=await savedConfig();
assert.equal(initial.settings.coastDetail,true);
assert.equal(rendered.at(-1).settings.coastDetail,true);
assert.equal(get('coastDetail'),undefined);
assert.equal(initial.settings.freshwater,false);
for(const id of ['geographicDetails','waterDetail','rivers','lakes'])assert.equal(get(id),undefined);
assert.equal(get('osmAttribution').hidden,false);

get('freshwater').checked=true;
await get('freshwater').emit('change');
const cfg=await savedConfig();
assert.ok(cfg.settings.coastDetail&&cfg.settings.freshwater);

await get('saveProject').emit('click');
const project=await downloads.at(-1).blob.text();
// Inject the legacy option into the settings object embedded in the project.
const legacyProject=JSON.parse(project);
legacyProject.config.settings.coastDetail=false;
get('projectFile').files=[{name:'test.tbm.json',text:async()=>JSON.stringify(legacyProject)}];
await get('projectFile').emit('change');
await flush();
assert.deepEqual(await savedConfig(),cfg);

get('basemap').value='osm';
await get('basemap').emit('change');
assert.equal(get('freshwater').disabled,true);
assert.equal(effectiveMapSettings((await savedConfig()).settings).coastDetail,false);
get('basemap').value='terrain';
await get('basemap').emit('change');
assert.equal(get('freshwater').disabled,false);
assert.equal(effectiveMapSettings((await savedConfig()).settings).coastDetail,true);

const bad=structuredClone(cfg);
bad.settings.freshwater='true';
await loadConfig(bad);
assert.deepEqual(await savedConfig(),cfg,'Invalid settings are atomic');

for(const value of [false,undefined]){
 const legacy=structuredClone(initial);
 legacy.settings.coastDetail=value;
 delete legacy.settings.freshwater;
 await loadConfig(legacy);
 assert.deepEqual(await savedConfig(),initial);
}

for(const legacyFlags of [{rivers:true,lakes:false},{rivers:false,lakes:true,waterDetail:true}]){
 const legacy=structuredClone(initial);
 delete legacy.settings.freshwater;
 Object.assign(legacy.settings,legacyFlags);
 await loadConfig(legacy);
 const saved=(await savedConfig()).settings;
 assert.equal(saved.freshwater,true);
 assert.ok(['rivers','lakes','waterDetail'].every(key=>!(key in saved)));
}
const current=structuredClone(initial);
current.settings.rivers=true;
await loadConfig(current);
assert.equal((await savedConfig()).settings.freshwater,false);
const status=MapRenderer.prototype.status;
try{
 for(const flag of ['detailPending','detailFailed']){
  MapRenderer.prototype.status=()=>({ready:false,[flag]:true,message:'test'});
  const n=downloads.length;
  await get('exportBtn').emit('click');
  assert.equal(downloads.length,n);
  assert.match(get('toast').textContent,/詳細地理圖層/);
  await get('codeBundle').emit('click');
  assert.equal(downloads.length,n);
 }
}finally{MapRenderer.prototype.status=status;}
console.log('PASS: automatic coastline, legacy settings and project migration, freshwater control, street map isolation and image/R readiness guards');
