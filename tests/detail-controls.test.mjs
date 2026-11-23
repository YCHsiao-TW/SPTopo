import assert from 'node:assert/strict';
import {openApp} from './support/app-fixture.mjs';
import {MapRenderer} from '../dist/map.mjs';
import {effectiveMapSettings} from '../dist/basemap-settings.mjs';

const {get,savedConfig,loadConfig,flush,downloads,rendered}=await openApp();
const initial=await savedConfig();
assert.equal(initial.settings.coastDetail,true);
assert.equal(rendered.at(-1).settings.coastDetail,true);
assert.equal(get('coastDetail'),undefined);
assert.equal(initial.settings.waterDetail,false);
assert.equal(get('geographicDetails').hidden,false);
assert.equal(get('osmAttribution').hidden,false);

get('waterDetail').checked=true;
await get('waterDetail').emit('change');
const cfg=await savedConfig();
assert.ok(cfg.settings.coastDetail&&cfg.settings.waterDetail);
assert.equal(get('legacyWaterSourceHint').hidden,true);

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
assert.equal(get('waterDetail').disabled,true);
assert.equal(effectiveMapSettings((await savedConfig()).settings).coastDetail,false);
get('basemap').value='terrain';
await get('basemap').emit('change');
assert.equal(get('waterDetail').disabled,false);
assert.equal(effectiveMapSettings((await savedConfig()).settings).coastDetail,true);

const bad=structuredClone(cfg);
bad.settings.waterDetail='true';
await loadConfig(bad);
assert.deepEqual(await savedConfig(),cfg,'Invalid settings are atomic');

for(const value of [false,undefined]){
 const legacy=structuredClone(initial);
 legacy.settings.coastDetail=value;
 delete legacy.settings.waterDetail;
 await loadConfig(legacy);
 assert.deepEqual(await savedConfig(),initial);
}

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
