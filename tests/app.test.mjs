import assert from 'node:assert/strict';
import {openApp} from './support/app-fixture.mjs';
import {MapRenderer} from '../dist/map.mjs';
import {MARKER_SHAPES} from '../dist/markers.mjs';
import {t,tx} from '../dist/i18n.mjs';

const app=await openApp(),{get,flush,loadCSV,loadConfig,savedConfig}=app;
const csv='longitude,latitude,species\n120.8,23.5,TES\n121.2,24.1,TWS\n121,23.8,Unknown';
let failures=0;
async function check(name,fn){try{await fn();console.log('PASS:',name);}catch(e){failures++;console.error('FAIL:',name,'—',e.message);}}

await check('World preview starts globally and the demo button restores its scope',async()=>{
 const initial=await savedConfig();assert.equal(initial.settings.ocean,true);
 for(const id of ['mapScope','counties','towns','countyLabels','townLabels']){
  assert.equal(get(id),undefined);
  assert.ok(!(id in initial.settings));
 }
 for(const option of get('region').options)assert.equal(option.hidden,false);
 assert.equal(get('region').options.filter(option=>option.value==='custom').length,1);
 for(const value of ['taiwan','all','twkinmen','kinmen','matsu','penghu','lyudao','lanyu','guishan','xiaoliuqiu'])assert.ok(!get('region').options.some(option=>option.value===value));
 assert.equal(get('recordStat').textContent,'9');assert.equal(get('groupStat').textContent,'3/3');
 assert.deepEqual(initial.referenceBounds,[-180,-80,180,80]);assert.equal(get('region').value,'world');
 await get('worldDemo').emit('click');assert.deepEqual((await savedConfig()).referenceBounds,initial.referenceBounds);assert.equal(get('recordStat').textContent,'9');
});

await check('CSV import, group filters, stable colors, table, language, page dimensions and map controls',async()=>{
 await loadCSV('records.csv',csv);assert.equal(get('recordStat').textContent,'3');assert.equal(get('groupStat').textContent,'3/3');assert.equal(get('fileLabel').textContent,'records.csv');
 const row=get('groupList').children.find(row=>row.children[2].textContent==='Unknown'),color=row.children[1].value;
 row.children[0].checked=false;await row.children[0].emit('change');assert.equal(get('groupStat').textContent,'2/3');
 await get('languageBtn').emit('click');assert.equal(get('groupStat').textContent,'2/3');assert.equal(get('fileLabel').textContent,'records.csv');
 await get('tableTab').emit('click');assert.equal(get('mapView').hidden,true);assert.equal(get('tableBody').children.length,2);
 await get('allGroups').emit('click');assert.equal(get('groupList').children.find(row=>row.children[2].textContent==='Unknown').children[1].value,color);
 get('aspectPreset').value='3:4';await get('aspectPreset').emit('change');assert.equal(get('pageWidth').value,18);assert.equal(get('pageHeight').value,24);
 await get('swapPage').emit('click');assert.equal(get('pageWidth').value,24);assert.equal(get('pageHeight').value,18);
 const before=(await savedConfig()).camera;await get('zoomIn').emit('click');assert.ok((await savedConfig()).camera.zoom>before.zoom);await get('resetBtn').emit('click');
 const map=get('map'),camera=(await savedConfig()).camera;await map.emit('keydown',{key:'ArrowRight'});assert.ok((await savedConfig()).camera.x>camera.x);
 await map.emit('pointerdown',{clientX:200,clientY:200,pointerId:1});const dragStart=(await savedConfig()).camera;await map.emit('pointermove',{clientX:300,clientY:200,pointerId:1});assert.ok((await savedConfig()).camera.x<dragStart.x);await map.emit('pointerup');await get('resetBtn').emit('click');
 await get('infoBtn').emit('click');assert.equal(get('infoDialog').open,true);await get('closeInfo').emit('click');assert.equal(get('infoDialog').open,false);
 await get('mapTab').emit('click');assert.equal(get('mapView').hidden,false);
});

await check('Legend toggles preserve the camera without cumulative zoom drift',async()=>{
 const before=(await savedConfig()).camera;
 for(let i=0;i<4;i++){get('legend').checked=false;await get('legend').emit('change');get('legend').checked=true;await get('legend').emit('change');}
 assert.deepEqual((await savedConfig()).camera,before);
});

await check('Taxon symbols survive filtering, language changes and settings restore; invalid files are atomic and legacy files use circles',async()=>{
 await loadCSV('records.csv',csv);
 const row=get('groupList').children.find(row=>row.children[2].textContent==='TES'),select=row.children[4];
 assert.equal(select.options.length,16);select.value='diamond';await select.emit('change');await flush();
 row.children[0].checked=false;await row.children[0].emit('change');await get('languageBtn').emit('click');
 assert.equal(get('groupList').children.find(row=>row.children[2].textContent==='TES').children[4].value,'diamond');
 assert.equal((await savedConfig()).shapes.TES,'diamond');await get('allGroups').emit('click');
 const cfg=await savedConfig();await loadConfig(cfg);assert.deepEqual(await savedConfig(),cfg);
 for(const invalid of [null,[],{TES:'not-a-symbol'}]){const bad=structuredClone(cfg);bad.shapes=invalid;bad.settings.radius=15;await loadConfig(bad);assert.deepEqual(await savedConfig(),cfg);}
 const legacy=structuredClone(cfg);delete legacy.shapes;await loadConfig(legacy);assert.deepEqual((await savedConfig()).shapes,{TES:'circle',TWS:'circle',Unknown:'circle'});
 await loadCSV('many.csv','longitude,latitude,species\n'+Array.from({length:27},(_,i)=>`${120+i/100},23,Species ${i}`).join('\n'));
 await get('autoShapes').emit('click');assert.deepEqual(Object.values((await savedConfig()).shapes),Array.from({length:27},(_,i)=>MARKER_SHAPES[i%MARKER_SHAPES.length]));
 await get('languageBtn').emit('click');await loadCSV('records.csv',csv);
});

await check('Global presets, overseas CSV records, basemap settings and backwards-compatible project restore',async()=>{
 await get('worldSample').emit('click');const worldCSV=await app.downloads.at(-1).blob.text();assert.match(worldCSV,/Sydney/);assert.match(worldCSV,/-74.01/);
 await loadCSV('world.csv',worldCSV);assert.equal(get('recordStat').textContent,'9');
 get('region').value='world';await get('region').emit('change');let cfg=await savedConfig();assert.deepEqual(cfg.referenceBounds,[-180,-80,180,80]);assert.ok(cfg.camera.zoom<3);
 get('countryLabels').checked=true;await get('countryLabels').emit('change');cfg=await savedConfig();await loadConfig(cfg);assert.equal((await savedConfig()).settings.countryLabels,true);
 const legacy=structuredClone(cfg);Object.assign(legacy.settings,{mapScope:'taiwan',counties:true,towns:true,countyLabels:true,townLabels:true});
 await loadConfig(legacy);assert.deepEqual(await savedConfig(),cfg);
 const taiwan=get('region').options.find(option=>option.value==='country_TWN');
 assert.equal(taiwan.parentElement.tagName,'OPTGROUP');
 get('region').value=taiwan.value;await get('region').emit('change');
 cfg=await savedConfig();assert.ok(cfg.camera.zoom>4);await loadConfig(cfg);assert.equal(get('region').value,taiwan.value);
 await loadCSV('records.csv',csv);get('countryLabels').checked=false;await get('countryLabels').emit('change');
});

await check('Legend studio toggles, typography, display names and independent dragging persist without panning the map',async()=>{
 await loadCSV('records.csv',csv);const baseline=await savedConfig();
 await get('legendStudioBtn').emit('click');assert.equal(get('legendEditor').hidden,false);
 get('legendEditTitle').value='Occurrences <test>';await get('legendEditTitle').emit('input');
 get('legendEditFont').value='19';await get('legendEditFont').emit('input');
 get('legendEditFamily').value='sans';await get('legendEditFamily').emit('change');
 get('legendEditBold').checked=true;await get('legendEditBold').emit('change');
 get('legendEditItalic').checked=false;await get('legendEditItalic').emit('change');
 get('legendEditDisplayName').value='TES display';await get('legendEditDisplayName').emit('input');
 get('editorLegendElevation').checked=false;await get('editorLegendElevation').emit('change');
 let cfg=await savedConfig();assert.equal(cfg.settings.legend,true);assert.equal(cfg.settings.legendElevation,false);assert.equal(cfg.settings.terrain,baseline.settings.terrain);assert.equal(cfg.settings.legendFont,19);assert.equal(cfg.settings.italic,false);assert.equal(cfg.legendEdits.taxa.family,'sans');assert.equal(cfg.legendEdits.taxa.bold,true);assert.equal(cfg.displayNames.TES,'TES display');
 const handle=get('legendHandles').children.find(b=>b.dataset.kind==='taxa'),camera=structuredClone(cfg.camera);
 await handle.emit('pointerdown',{clientX:1000,clientY:90,pointerId:2,button:0});await handle.emit('pointermove',{clientX:800,clientY:210});await handle.emit('pointerup');await handle.emit('click');await flush();
 cfg=await savedConfig();assert.ok(cfg.legendEdits.taxa.x<80);assert.ok(cfg.legendEdits.taxa.y>6.25);assert.deepEqual(cfg.camera,camera);assert.equal(cfg.legendEdits.elevation,undefined);
 await handle.emit('keydown',{key:'ArrowRight',shiftKey:true});await flush();assert.ok((await savedConfig()).legendEdits.taxa.x>cfg.legendEdits.taxa.x);
 cfg=await savedConfig();await loadConfig(cfg);assert.deepEqual(await savedConfig(),cfg);
 await get('languageBtn').emit('click');assert.equal(get('legendEditTitle').value,'Occurrences <test>');assert.equal(get('legendEditDisplayName').value,'TES display');await get('languageBtn').emit('click');
 for(const change of [c=>c.legendEdits={taxa:{family:'url(evil)'}},c=>c.legendEdits={depth:{x:101}},c=>c.legendEdits={taxa:{columns:1.5}},c=>c.displayNames={TES:5}]){const bad=structuredClone(cfg);change(bad);await loadConfig(bad);assert.deepEqual(await savedConfig(),cfg);}
 const legacy=structuredClone(cfg);delete legacy.legendEdits;delete legacy.displayNames;for(const k of ['legendSpecies','legendElevation','legendDepth','legendWater'])delete legacy.settings[k];await loadConfig(legacy);const old=await savedConfig();assert.deepEqual(old.legendEdits,{});assert.deepEqual(old.displayNames,{});assert.equal(old.settings.legendElevation,true);
 await loadConfig(cfg);await get('resetLegendBlock').emit('click');assert.equal((await savedConfig()).legendEdits.taxa,undefined);assert.deepEqual((await savedConfig()).displayNames,{});
 await get('closeLegendEditor').emit('click');assert.equal(get('legendEditor').hidden,true);await loadConfig(baseline);
});

await check('Legend display names can mix italics with upright authorities and retain formatting in projects',async()=>{
 await loadCSV('authorities.csv',csv);
 await get('legendStudioBtn').emit('click');
 get('legendEditTaxon').value='TES';await get('legendEditTaxon').emit('change');
 const label=get('legendEditDisplayName'),authority=' (Linné, 1758)',scientific='Araneus diadematus';
 label.value=scientific+authority;
 label.setSelectionRange(label.value.length,label.value.length);
 await label.emit('input');
 assert.equal(get('legendNameUpright').disabled,true);
 label.setSelectionRange(scientific.length+1,label.value.length);
 await label.emit('select');
 assert.equal(get('legendNameUpright').disabled,false);
 await get('legendNameUpright').emit('click');
 const style=get('legendNamePreview').children.map(span=>[span.textContent,span.style.fontStyle]);
 assert.deepEqual(style,[[scientific+' ','italic'],[authority.trim(),'normal']]);
 const before=await savedConfig();
 assert.deepEqual(before.legendEdits.taxa.nameRuns.TES,[{text:scientific+' ',italic:null},{text:authority.trim(),italic:false}]);
 await get('saveProject').emit('click');
 const project=await app.downloads.at(-1).blob.text();
 await get('legendNameReset').emit('click');
 assert.equal((await savedConfig()).legendEdits.taxa,undefined);
 get('projectFile').files=[app.file('formatted.tbm.json',project)];
 await get('projectFile').emit('change');await flush();
 assert.deepEqual((await savedConfig()).legendEdits.taxa.nameRuns,before.legendEdits.taxa.nameRuns);
 const newName=scientific+authority.replace('1758','1759');
 label.value=newName;
 label.setSelectionRange(newName.length-1,newName.length-1);
 await label.emit('input');
 assert.equal(get('legendNamePreview').children[1].textContent,'(Linné, 1759)');
 assert.equal(get('legendNamePreview').children[1].style.fontStyle,'normal');
 label.setSelectionRange(scientific.length+1,newName.length);
 await label.emit('keydown',{key:'i',metaKey:true});
 assert.equal(get('legendNamePreview').children.at(-1).style.fontStyle,'italic');
 await get('resetLegendBlock').emit('click');
 await get('closeLegendEditor').emit('click');
});

await check('Legend title selection persists, rejects invalid values atomically and supports older settings',async()=>{
 assert.equal((await savedConfig()).settings.legendTitle,'species');
 const before=(await savedConfig()).camera;
 get('legendTitle').value='groups';await get('legendTitle').emit('change');
 const config=await savedConfig();assert.equal(config.settings.legendTitle,'groups');assert.deepEqual(config.camera,before);
 await loadConfig(config);assert.equal(get('legendTitle').value,'groups');
 const bad=structuredClone(config);bad.settings.legendTitle='invalid';await loadConfig(bad);assert.deepEqual(await savedConfig(),config);
 delete config.settings.legendTitle;await loadConfig(config);assert.equal((await savedConfig()).settings.legendTitle,'species');assert.equal(get('legendTitle').value,'species');
});

await check('Province boundaries, names and width persist, support legacy files and turn off in Minimal mode',async()=>{
 get('provinces').checked=true;await get('provinces').emit('change');get('provinceLabels').checked=true;await get('provinceLabels').emit('change');get('provinceWidth').value='0.85';await get('provinceWidth').emit('input');
 const cfg=await savedConfig();assert.equal(cfg.settings.provinces,true);assert.equal(cfg.settings.provinceLabels,true);assert.equal(cfg.settings.provinceWidth,.85);
 await loadConfig(cfg);assert.equal(get('provinces').checked,true);assert.equal(Number(get('provinceWidth').value),.85);
 const invalid=structuredClone(cfg);invalid.settings.provinceWidth=8;await loadConfig(invalid);assert.deepEqual(await savedConfig(),cfg);
 const legacy=structuredClone(cfg);for(const key of ['provinces','provinceLabels','provinceWidth'])delete legacy.settings[key];await loadConfig(legacy);let restored=await savedConfig();assert.equal(restored.settings.provinces,false);assert.equal(restored.settings.provinceLabels,false);assert.equal(restored.settings.provinceWidth,.55);
 await loadConfig(cfg);await get('minimalBtn').emit('click');restored=await savedConfig();assert.equal(restored.settings.provinces,false);assert.equal(restored.settings.provinceLabels,false);
 await loadConfig({...cfg,settings:{...cfg.settings,provinces:false,provinceLabels:false}});
});

await check('Province data loading/failure blocks exports with a specific explanation',async()=>{
 const original=MapRenderer.prototype.status,count=app.downloads.length;
 try{
  MapRenderer.prototype.status=()=>({ready:false,adminPending:true,message:'彩色海拔已關閉 · 行政區底圖'});
  await get('exportBtn').emit('click');assert.equal(app.downloads.length,count);assert.match(get('toast').textContent,/Province\/state data is loading|省州界線正在載入/);
  MapRenderer.prototype.status=()=>({ready:false,adminFailed:true,failed:1,message:'彩色海拔已關閉 · 行政區底圖'});
  await get('exportBtn').emit('click');assert.equal(app.downloads.length,count);assert.match(get('toast').textContent,/Province\/state data failed|省州界線載入失敗/);
 }finally{MapRenderer.prototype.status=original;}
});

await check('An invalid settings file leaves settings, filters, columns and camera unchanged',async()=>{
 const before=await savedConfig(),bad=structuredClone(before);bad.settings.radius=17;bad.referenceBounds=[122,25,119,21];bad.columns={lon:'longitude',lat:'latitude',group:''};
 await loadConfig(bad);assert.deepEqual(await savedConfig(),before);assert.match(get('toast').textContent,/失敗|Could not load/);
});

await check('Settings reject identical longitude/latitude columns before applying changes',async()=>{
 await loadCSV('records.csv',csv);const before=await savedConfig(),bad=structuredClone(before);bad.columns.lat=bad.columns.lon;
 await loadConfig(bad);assert.deepEqual(await savedConfig(),before);assert.equal(get('recordStat').textContent,'3');
});

await check('Valid settings round-trip, older settings retain page defaults, and incompatible columns are rejected',async()=>{
 await loadCSV('records.csv',csv);const cfg=await savedConfig();cfg.settings.radius=11;cfg.settings.pageWidth=18;cfg.settings.pageHeight=24;cfg.colors.TES='#123456';cfg.selected=['TES','TWS'];cfg.referenceBounds=[118.1,24.35,118.52,24.57];
 await loadConfig(cfg);assert.deepEqual(await savedConfig(),cfg);assert.equal(get('groupStat').textContent,'2/3');assert.equal(get('region').value,'custom');
 const bad=structuredClone(cfg);bad.columns.lon='missing';await loadConfig(bad);assert.deepEqual(await savedConfig(),cfg);
 for(const mutate of [c=>c.settings.radius='large',c=>c.selected='TES',c=>c.camera.zoom=99,c=>c.settings.pieMode='other']){const invalid=structuredClone(cfg);mutate(invalid);await loadConfig(invalid);assert.deepEqual(await savedConfig(),cfg);}
 const legacy=structuredClone(cfg);for(const key of ['pageWidth','pageHeight','legendPosition','legendColumns','legendFont','legendSymbol','legendX','legendY','siteNumbers','siteLabelSize','terrainQuality'])delete legacy.settings[key];await loadConfig(legacy);assert.equal(get('pageWidth').value,25);assert.equal(get('pageHeight').value,20);assert.equal(get('legendPosition').value,'right');assert.equal(get('siteNumbers').checked,false);assert.equal(get('terrainQuality').value,'auto');
});

await check('Excluded-row download reports errors, empty selection blocks export, and failed imports preserve data',async()=>{
 await loadCSV('invalid.csv','longitude,latitude,species\n120,23,TES\n,24,TWS\n121,91,TWS');assert.equal(get('recordStat').textContent,'1');assert.equal(get('invalidBtn').hidden,false);
 await get('invalidBtn').emit('click');const excluded=await app.downloads.at(-1).blob.text();assert.ok(excluded.includes('Missing coordinates'));assert.ok(excluded.includes('Outside coordinate'));
 const before=await savedConfig();await loadCSV('bad.csv','lon,lat\n"unclosed');assert.deepEqual(await savedConfig(),before);assert.equal(get('fileLabel').textContent,'invalid.csv');
 const checkbox=get('groupList').children[0].children[0];checkbox.checked=false;await checkbox.emit('change');const count=app.downloads.length;await get('exportBtn').emit('click');assert.equal(app.downloads.length,count);assert.match(get('toast').textContent,/Select at least|至少選擇/);
});

await check('CSV-only import rejects invalid encoding and non-CSV files without replacing data',async()=>{
 await loadCSV('keep.csv',csv);
 const prefix=new TextEncoder().encode('longitude,latitude,species\n121,23,'),data=new Uint8Array([...prefix,0xa5,0x78,0xc6,0x57]);
 get('csvFile').files=[{name:'big5.csv',arrayBuffer:async()=>data.buffer}];await get('csvFile').emit('change');await flush();
 assert.equal(get('fileLabel').textContent,'keep.csv');assert.match(get('toast').textContent,/UTF-8 CSV/);
 await loadCSV('bad.tsv',csv);assert.equal(get('fileLabel').textContent,'keep.csv');
 await get('dropzone').emit('drop',{preventDefault(){},dataTransfer:{files:[{name:'bad.xlsx',arrayBuffer:async()=>new TextEncoder().encode(csv).buffer}]}});await flush();assert.equal(get('fileLabel').textContent,'keep.csv');
 await loadCSV('VALID.CSV',csv);assert.equal(get('fileLabel').textContent,'VALID.CSV');
});

await check('A slower previous CSV cannot replace the latest import or a newly loaded demo',async()=>{
 let finish;
 const wait=new Promise(resolve=>finish=resolve);get('csvFile').files=[{name:'old.csv',arrayBuffer:()=>wait}];await get('csvFile').emit('change');
 await loadCSV('new.csv',csv);finish(new TextEncoder().encode('longitude,latitude,species\n120,22,Old').buffer);await flush();assert.equal(get('fileLabel').textContent,'new.csv');
 let finishDemo;const waitDemo=new Promise(resolve=>finishDemo=resolve);get('csvFile').files=[{name:'pending.csv',arrayBuffer:()=>waitDemo}];await get('csvFile').emit('change');
 await get('worldDemo').emit('click');finishDemo(new TextEncoder().encode(csv).buffer);await flush();assert.match(get('fileLabel').textContent,/示範|Demo/);
});

await check('Batch settings remain tied to the exported dataset while the user imports another CSV',async()=>{
 await loadCSV('records.csv',csv);await get('autoShapes').emit('click');get('format').value='svg';const before=await savedConfig(),count=app.downloads.length,renderCount=app.rendered.length;
 const exporting=get('batchBtn').emit('click');
 await loadCSV('other.csv','lon,lat,taxon\n120,23,Other');
 await flush();await exporting;await flush();
 const download=app.downloads.slice(count).find(d=>d.name.endsWith('.zip'));assert.ok(download,'Batch ZIP was created');
 const bytes=new Uint8Array(await download.blob.arrayBuffer()),view=new DataView(bytes.buffer),decoder=new TextDecoder(),files=new Map();let offset=0;
 while(view.getUint32(offset,true)===0x04034b50){const size=view.getUint32(offset+18,true),n=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true),name=decoder.decode(bytes.subarray(offset+30,offset+30+n)),start=offset+30+n+extra;files.set(name,decoder.decode(bytes.subarray(start,start+size)));offset=start+size;}
 const settings=JSON.parse([...files].find(([name])=>name.endsWith('/settings.json'))[1]);assert.deepEqual(settings,before);
 const batchScenes=app.rendered.slice(renderCount).filter(scene=>scene.groups.includes('TES'));assert.ok(batchScenes.length>=4);for(const scene of batchScenes)assert.deepEqual(scene.shapes,before.shapes);
 const notes=[...files].find(([name])=>name.endsWith('/SOURCES.txt'))[1];assert.ok(notes.includes('\nDemonstration data:'));assert.ok(!notes.includes('\\n'));
});

await check('Complete projects restore original records, layout, filters, site IDs, export choices and filenames',async()=>{
 await loadCSV('original.csv',csv+'\n,24,TES');get('prefix').value='project_map';get('format').value='svg';get('exportWidth').value='1500';
 const cfg=await savedConfig();Object.assign(cfg.settings,{legendPosition:'custom',legendColumns:2,legendFont:18,legendSymbol:6,legendX:15,legendY:35,siteNumbers:true,siteLabelSize:14});cfg.selected=['TWS','Unknown'];cfg.colors.TWS='#123456';cfg.shapes.TWS='triangle';cfg.shapes.Unknown='cross';cfg.legendEdits={taxa:{family:'sans',title:'Saved title',x:15,y:25,bold:true}};cfg.displayNames={TWS:'Project taxon'};await loadConfig(cfg);
 await get('downloadSites').emit('click');const reference=await app.downloads.at(-1).blob.text();assert.ok(reference.includes('S002'));assert.ok(!reference.includes('S001'));
 await get('saveProject').emit('click');const download=app.downloads.at(-1);assert.equal(download.name,'project_map.tbm.json');const text=await download.blob.text(),project=JSON.parse(text);assert.equal(project.data.rows.length,4);
 await get('worldDemo').emit('click');get('prefix').value='other';get('projectFile').files=[app.file('saved.tbm.json',text)];await get('projectFile').emit('change');await flush();
 assert.equal(get('fileLabel').textContent,'original.csv');assert.equal(get('invalidBtn').hidden,false);assert.equal(get('groupStat').textContent,'2/3');assert.equal(get('prefix').value,'project_map');assert.equal(Number(get('exportWidth').value),1500);assert.equal(get('legendCustom').hidden,false);assert.deepEqual(await savedConfig(),cfg);
 await get('downloadSites').emit('click');assert.equal(await app.downloads.at(-1).blob.text(),reference);
 const before=await savedConfig(),bad=structuredClone(project);bad.config.settings.legendColumns=0;get('projectFile').files=[app.file('bad.json',JSON.stringify(bad))];await get('projectFile').emit('change');await flush();assert.deepEqual(await savedConfig(),before);assert.equal(get('fileLabel').textContent,'original.csv');
 const exporting=get('batchBtn').emit('click');await flush();await exporting;await flush();const zip=app.downloads.at(-1);assert.ok(zip.name.endsWith('.zip'));const data=new Uint8Array(await zip.blob.arrayBuffer()),v=new DataView(data.buffer),decoder=new TextDecoder();let offset=0,tables=[];
 while(v.getUint32(offset,true)===0x04034b50){const size=v.getUint32(offset+18,true),n=v.getUint16(offset+26,true),name=decoder.decode(data.subarray(offset+30,offset+30+n)),start=offset+30+n;if(name.endsWith('_sites.csv'))tables.push({name,text:decoder.decode(data.subarray(start,start+size))});offset=start+size;}
 assert.equal(tables.length,3);assert.ok(tables.find(t=>t.name.includes('/TWS/')).text.includes('S002'));assert.ok(tables.find(t=>t.name.includes('/Unknown/')).text.includes('S003'));
});

await check('Marine/freshwater presets, saved water settings and legacy compatibility',async()=>{
 await get('marineDemo').emit('click');let cfg=await savedConfig();assert.equal(get('recordStat').textContent,'8');assert.equal(cfg.settings.bathymetry,true);assert.equal(cfg.settings.isobaths,false);assert.equal(cfg.settings.ocean,true);assert.equal(cfg.settings.terrain,false);assert.deepEqual(cfg.referenceBounds,[116,5,150,35]);
 const marine=structuredClone(cfg);await loadConfig(marine);assert.deepEqual(await savedConfig(),marine);
 await get('freshwaterDemo').emit('click');cfg=await savedConfig();assert.equal(cfg.settings.freshwater,true);assert.equal(cfg.settings.bathymetry,false);assert.equal(cfg.settings.ocean,false);assert.deepEqual(cfg.referenceBounds,[-94,40,-72,50]);assert.equal(get('recordStat').textContent,'5');
 const invalid=structuredClone(cfg);invalid.settings.freshwater='true';await loadConfig(invalid);assert.deepEqual(await savedConfig(),cfg);
 for(const key of ['ocean','bathymetry','isobaths','freshwater'])delete cfg.settings[key];await loadConfig(cfg);const legacy=await savedConfig();for(const key of ['ocean','bathymetry','isobaths','freshwater'])assert.equal(legacy.settings[key],key==='ocean');
});
await check('Required water layers block exports with loading/failure explanations',async()=>{
 const original=MapRenderer.prototype.status,count=app.downloads.length;
 try{for(const [key,pattern] of [['waterPending',/Water layers are loading|水域圖層正在載入/],['waterFailed',/Water layers failed to load|水域圖層載入失敗/]]){
  MapRenderer.prototype.status=()=>({ready:false,[key]:true,message:'test'});await get('exportBtn').emit('click');assert.equal(app.downloads.length,count);assert.match(get('toast').textContent,pattern);
 }}finally{MapRenderer.prototype.status=original;}
});

await check('Elevation options and DEM cache round-trip with multilingual preferences; invalid analysis files are atomic',async()=>{
 await loadCSV('heights.csv','longitude,latitude,species,elevation\n121,24,Taxon alpha,0\n122,25,Taxon beta,200');
 let cfg=await savedConfig();assert.equal(cfg.analysis.column,'elevation');assert.equal(cfg.analysis.source,'csv');
 cfg.analysis={...cfg.analysis,source:'fill',unit:'records',font:18,title:'Elevation test',samples:{'121,24':120}};await loadConfig(cfg);assert.deepEqual(await savedConfig(),cfg);
 for(const lang of ['zh-Hans','es','fr','de','ja','ko','ru','ar','hi','en','zh-Hant']){get('languageSelect').value=lang;await get('languageSelect').emit('change');await flush();const next=await savedConfig();assert.equal(next.language,lang);assert.deepEqual(next.analysis,cfg.analysis);assert.deepEqual(next.colors,cfg.colors);assert.deepEqual(next.shapes,cfg.shapes);assert.equal(get('groupList').children[0].children[2].textContent,'Taxon alpha');}
 cfg=await savedConfig();for(const invalid of [{font:50},{source:'automatic'},{samples:{'181,0':100}},{bandStops:'0,0,10'}]){const bad=structuredClone(cfg);Object.assign(bad.analysis,invalid);bad.settings.radius=15;await loadConfig(bad);assert.deepEqual(await savedConfig(),cfg);}
 await get('saveProject').emit('click');const project=app.downloads.at(-1),text=await project.blob.text();await get('worldDemo').emit('click');get('projectFile').files=[app.file('heights.tbm.json',text)];await get('projectFile').emit('change');await flush();assert.deepEqual(await savedConfig(),cfg);
 const legacy=structuredClone(cfg);delete legacy.analysis;await loadConfig(legacy);assert.equal((await savedConfig()).analysis.unit,'sites');assert.deepEqual((await savedConfig()).analysis.samples,{});
});

await check('All language switches localize malformed-file and CSV row errors without changing imported data',async()=>{
 const before=await savedConfig();
 for(const lang of ['zh-Hant','zh-Hans','en','es','fr','de','ja','ko','ru','ar','hi']){
  get('languageSelect').value=lang;await get('languageSelect').emit('change');await flush();
  get('configFile').files=[app.file('bad.json','{')];await get('configFile').emit('change');await flush();assert.equal(get('toast').textContent,tx('configFailed',{reason:t('不是支援的地圖設定檔。')}));
  await loadCSV('bad.csv','longitude,latitude,species\n121,24,A,extra');assert.equal(get('toast').textContent,tx('importFailed',{reason:t('第 2 列欄位數與標題不同；含逗號的文字需加雙引號。')}));
  const after=await savedConfig();assert.deepEqual(after.analysis,before.analysis);assert.deepEqual(after.selected,before.selected);assert.deepEqual(after.colors,before.colors);
 }
});

if(failures)throw Error(`${failures} app behavior checks failed`);
