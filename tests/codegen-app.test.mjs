import assert from 'node:assert/strict';
import {openApp} from './support/app-fixture.mjs';
import {MapRenderer} from '../dist/map.mjs';
const app=await openApp(),{get,savedConfig,loadConfig,loadCSV,flush}=app;
await get('codeTab').emit('click');assert.equal(get('codeView').hidden,false);assert.equal(get('canvasTopline').hidden,true);assert.match(get('codePreview').value,/editable geographic map/);assert.equal(get('codeBundle').disabled,false);assert.equal(get('codeTask'),undefined);
await get('codeBundle').emit('click');const zip=app.downloads.at(-1);assert.equal(zip.name,'SPTopo_editable_R_v4.zip');assert.ok(zip.blob.size>10000);assert.ok(!(await zip.blob.text()).includes('basemap.png'));assert.ok((await zip.blob.text()).includes('countries.geojson'));
const status=MapRenderer.prototype.status;MapRenderer.prototype.status=()=>({ready:false});const count=app.downloads.length;await get('codeBundle').emit('click');assert.equal(app.downloads.length,count,'Never exports a partially loaded basemap');MapRenderer.prototype.status=status;
get('exportWidth').value='1500';await get('exportWidth').emit('change');assert.match(get('codePreview').value,/output_pixels = 1500/);
await loadCSV('original.csv','lat,lon,species\n24.123456789,121.123456789,001\n25,122,B');assert.equal(get('codeDemoNote').hidden,true);await get('codeBundle').emit('click');assert.match(await app.downloads.at(-1).blob.text(),/"121.123456789","24.123456789","001"/);
assert.equal(get('codeCopy'),undefined);assert.equal(get('codeDownload'),undefined);assert.equal(get('codeCSV'),undefined);for(const file of ['map.R','install_packages.R','packages.txt','taxa.csv','occurrences.csv','source_records.csv','config.json','website_settings.json','README.txt','SOURCES.txt'])assert.ok((await app.downloads.at(-1).blob.text()).includes(file));
const cfg=await savedConfig();assert.equal(cfg.codegen,undefined);await loadConfig({...cfg,codegen:{task:'sdm',obsolete:true}});assert.deepEqual(await savedConfig(),cfg,'Older project generator options are ignored without losing map settings');
await get('saveProject').emit('click');const project=await app.downloads.at(-1).blob.text();get('projectFile').files=[app.file('map.tbm.json',project)];await get('projectFile').emit('change');await flush();assert.deepEqual(await savedConfig(),cfg);
for(const language of ['en','ar','zh-Hans','zh-Hant']){get('languageSelect').value=language;await get('languageSelect').emit('change');assert.match(get('codePreview').value,/cfg <- modifyList/);assert.doesNotMatch(get('codePreview').value,/\p{Script=Han}/u);}
await get('topExport').emit('click');assert.equal(get('codeView').hidden,true);assert.equal(get('mapView').hidden,false);assert.equal(get('legendStudioBtn').hidden,false);
console.log('PASS: R-map tab, single complete ZIP download, readiness guard, original CSV, retired options, project compatibility and language switching');

assert.ok((await zip.blob.text()).includes("SPTopo_editable_R/map.R"));
assert.ok((await zip.blob.text()).includes("editable geographic map, version 4"));
assert.ok(!(await zip.blob.text()).includes("Choose map_scene.json"));
assert.ok(!(await zip.blob.text()).includes("SPTopo_editable_R/counties.geojson"));

await loadCSV('kinmen.csv','longitude,latitude,species\n118.38679,24.47449,Coastal specimen');
const localConfig=await savedConfig();
await loadConfig({...localConfig,settings:{...localConfig.settings,mapScope:'taiwan',counties:true,towns:true,provinceLabels:true,provinces:true}});
assert.equal(get('provinces').disabled,false);
assert.equal(get('provinces').checked,true);
await get('codeBundle').emit('click');
const data=new Uint8Array(await app.downloads.at(-1).blob.arrayBuffer()), headers=new DataView(data.buffer);
const decode=new TextDecoder(),files=new Map();
for(let start=0;headers.getUint32(start,true)===0x04034b50;){
 const pathSize=headers.getUint16(start+26,true), extraSize=headers.getUint16(start+28,true), payloadSize=headers.getUint32(start+18,true);
 const payload=start+30+pathSize+extraSize,file=decode.decode(data.subarray(start+30,start+30+pathSize)).replace(/^SPTopo_editable_R\//,'');
 files.set(file,data.subarray(payload,payload+payloadSize));
 start=payload+payloadSize;
}
const readText=file=>decode.decode(files.get(file));
const coast=JSON.parse(readText('coast-detail/selection.json'));
assert.equal(JSON.parse(readText('config.json')).coast_detail,true);
assert.deepEqual(coast.files,['tiles/29_11_1.json']);
const regional=JSON.parse(readText('coast-detail/'+coast.files[0]+'.geojson'));
for(const kind of ['coast','land'])assert.ok(regional.features.some(f=>f.properties.kind===kind));
assert.ok(files.has('coast-detail/overview.json.geojson'));
assert.match(readText('map.R'),/land <- coast\$land; shore <- coast\$line/);
assert.match(readText('SOURCES.txt'),/OpenStreetMap contributors/);
assert.match(readText('SOURCES.txt'),/Natural Earth Admin 1 5\.1\.0/);
assert.doesNotMatch(readText('SOURCES.txt'),/Taiwan Atlas/);
assert.ok(files.has('provinces.geojson')&&files.has('land.geojson'));
assert.ok([...files.keys()].every(name=>!/counties|towns|taiwan-atlas/i.test(name)));
assert.ok(!('map_scope' in JSON.parse(readText('config.json'))));
for(const name of ['map.R','install_packages.R','README.txt'])assert.doesNotMatch(readText(name),/\p{Script=Han}/u);
assert.match(readText('README.txt'),/Rscript install_packages\.R/);
assert.ok(!readText('export_notes.json').includes('Fine coast tiles'));
console.log('PASS: Kinmen R ZIP contains the real local OSM coast vectors, global overview, and matching source attribution');
