import assert from 'node:assert/strict';
import {openApp} from './support/app-fixture.mjs';
import {MapRenderer} from '../dist/map.mjs';
import {STREET_PAUSED} from '../dist/basemap-settings.mjs';
const app=await openApp(),{get,savedConfig,loadConfig,flush}=app;
const change=async(id,value)=>{if(typeof value==='boolean')get(id).checked=value;else get(id).value=value;await get(id).emit('change');};
const original=await savedConfig();assert.equal(original.settings.basemap,'terrain');assert.equal(get('osmAttribution').hidden,false);
await change('projection','robinson');await change('bathymetry',true);await change('provinces',true);
await get('legendStudioBtn').emit('click');await change('legendEditTarget','depth');const before=await savedConfig();await change('basemap','osm');const cfg=await savedConfig();assert.equal(cfg.settings.projection,'robinson');assert.equal(cfg.settings.bathymetry,true);assert.deepEqual(cfg.camera,before.camera,'Street view preserves the camera and projection');
assert.equal(get('projection').value,'robinson');assert.equal(get('projection').disabled,false);assert.equal(get('streetHint').hidden,false);assert.equal(get('osmAttribution').hidden,false);
for(const id of STREET_PAUSED)assert.equal(get(id).disabled,true,id+' is clearly paused');assert.equal(get('legendEditTarget').value,'taxa');await change('legendEditTarget','depth');assert.equal(get('legendEditTarget').value,'taxa','Unavailable legend cannot crash the editor');
await get('saveProject').emit('click');const project=await app.downloads.at(-1).blob.text();await change('basemap','terrain');assert.equal(get('projection').value,'robinson');assert.equal(get('projection').disabled,false);assert.equal(get('bathymetry').checked,true);assert.equal(get('terrain').disabled,false);
get('projectFile').files=[app.file('street-map.tbm.json',project)];await get('projectFile').emit('change');await flush();assert.deepEqual(await savedConfig(),cfg);assert.equal(get('projection').value,'robinson');
await change('projection','equalEarth');assert.equal(get('projection').value,'equalEarth');assert.equal((await savedConfig()).settings.basemap,'osm');await loadConfig(cfg);
const invalid=structuredClone(cfg);invalid.settings.basemap='untrusted-service';await loadConfig(invalid);assert.deepEqual(await savedConfig(),cfg,'Unknown provider is rejected atomically');
for(const lang of ['en','ar','zh-Hans','zh-Hant']){await change('languageSelect',lang);assert.equal(get('osmAttribution').hidden,false);assert.equal((await savedConfig()).settings.basemap,'osm');}
const status=MapRenderer.prototype.status;try{for(const flag of ['streetPending','streetFailed']){MapRenderer.prototype.status=()=>({ready:false,[flag]:true,message:'test'});const n=app.downloads.length;await get('exportBtn').emit('click');assert.equal(app.downloads.length,n);assert.match(get('toast').textContent,/街道底圖/);await get('codeTab').emit('click');await get('codeBundle').emit('click');assert.equal(app.downloads.length,n);}}finally{MapRenderer.prototype.status=status;}
await get('marineDemo').emit('click');assert.equal((await savedConfig()).settings.basemap,'terrain');assert.equal(get('basemap').value,'terrain');assert.equal(get('bathymetry').disabled,false);assert.equal(get('osmAttribution').hidden,false);
const legacy=structuredClone(original);delete legacy.settings.basemap;await loadConfig(legacy);assert.equal((await savedConfig()).settings.basemap,'terrain');
console.log('PASS: street switch, preserved settings/camera, effective projection, paused controls, safe legend editor, project/legacy compatibility, error guards and marine-demo restoration');

const current=await savedConfig(),group=Object.keys(current.shapes)[0];assert.ok(group);const retired={...current,settings:{...current.settings,basemap:'topo'},shapes:{[group]:'heart'}};await loadConfig(retired);const migrated=await savedConfig();assert.equal(migrated.settings.basemap,'osm');assert.equal(migrated.shapes[group],'circle');
const question={...migrated,shapes:{[group]:'question'}};await loadConfig(question);assert.equal((await savedConfig()).shapes[group],'question');
