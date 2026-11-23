import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {Admin1Layer,admin1Path,visibleAdmin1} from '../dist/admin1.mjs';
import {MapRenderer,defaultCamera} from '../dist/map.mjs';
import {pngBlob,pdfBlob} from '../dist/export.mjs';

const data=JSON.parse(await fs.readFile(new URL('../dist/assets/world-admin1.json',import.meta.url),'utf8'));
assert.ok(data.features.length>9000);assert.ok(data.labels.length>4400);
assert.equal(data.source.boundary_version,'5.1.0');assert.equal(data.source.label_version,'5.1.1');
for(const iso of ['USA','CAN','CHN','JPN','AUS','BRA']){
 assert.ok(data.features.some(f=>f.properties.country===iso),'Boundaries for '+iso);
 assert.ok(data.labels.some(f=>f.country===iso),'Names for '+iso);
}
assert.ok(!data.features.some(f=>f.properties.country==='TWN'));
assert.ok(!data.labels.some(f=>f.country==='TWN'));
for(const f of data.features){assert.ok(['LineString','MultiLineString'].includes(f.geometry.type));assert.ok(f.bbox.every(Number.isFinite));assert.ok(f.bbox[0]>=-180&&f.bbox[2]<=180&&f.bbox[1]>=-85&&f.bbox[3]<=85);}
const japan=visibleAdmin1(data,[129,30,146,46]);assert.ok(japan.length>30&&japan.length<data.features.length/5,'Cull off-screen worldwide boundaries');
assert.equal(admin1Path({type:'MultiLineString',coordinates:[[[1,2],[3,4]],[[5,6],[7,8]]]},(x,y)=>[x,y]),'M1.00,2.00L3.00,4.00M5.00,6.00L7.00,8.00');

let calls=0,updates=0;globalThis.fetch=async()=>{calls++;return calls===1?new Response('',{status:503}):new Response(JSON.stringify(data));};
const layer=new Admin1Layer(()=>updates++);assert.equal(layer.state,'idle');assert.equal(calls,0);
const pending=layer.load();assert.equal(pending,layer.load(),'Concurrent renders reuse the same request');await pending;
assert.equal(layer.state,'error');await layer.load();assert.equal(calls,1,'A failed load waits for explicit retry');
await layer.retry();assert.equal(layer.state,'ready');assert.equal(calls,2);assert.equal(updates,2);

const require=createRequire(import.meta.url),native=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'):'@napi-rs/canvas');
globalThis.Path2D=native.Path2D;globalThis.document={createElement(){const c=native.createCanvas(1,1);c.toBlob=cb=>cb(new Blob([c.toBuffer('image/png')],{type:'image/png'}));return c;}};
let adminRequests=0;globalThis.fetch=async url=>{if(url.includes('admin1'))adminRequests++;return new Response(await fs.readFile(new URL('../dist/'+url,import.meta.url)));};
const canvas=document.createElement('canvas'),renderer=new MapRenderer(canvas,()=>{});await renderer.init();
const settings={mapScope:'world',terrain:false,provinces:true,provinceLabels:true,provinceWidth:.55,countries:false,countryLabels:false,counties:false,towns:false,legend:true,frame:true};
const state={settings,language:'en',camera:defaultCamera(settings,[-126,24,-66,50]),sites:[],groups:[],colors:{},demo:false};
renderer.render({...state,settings:{...settings,provinces:false,provinceLabels:false}});assert.equal(adminRequests,0,'Default startup does not load the optional dataset');
const loading=renderer.status(state);assert.equal(loading.ready,false);assert.equal(loading.adminPending,true);
await renderer.admin1.promise;assert.equal(renderer.status(state).ready,true);assert.equal(adminRequests,1);
const out=new URL('../qa/',import.meta.url);await fs.mkdir(out,{recursive:true});
for(const [name,bounds,language,expected] of [['usa',[-126,24,-66,50],'en','Texas'],['japan',[129,30,146,46],'en','Hokkaid'],['china',[73,18,135,54],'zh-Hant','新疆']]){
 const scene={...state,language,camera:defaultCamera(settings,bounds)},result=renderer.render(scene,{width:1500,svg:true});
 assert.ok(result.svg.includes('data-layer="admin1-boundaries"'));assert.ok(result.svg.includes('data-layer="admin1-labels"'));
 assert.ok(result.svg.includes(expected),name+' labels follow map language');assert.ok(!result.svg.includes('stroke="#64745c"'),'Internal boundaries are independent from country boundaries');
 assert.ok((await pngBlob(canvas,'Admin-1 QA')).size>1000);assert.ok(pdfBlob(canvas,'Admin-1 QA').size>1000);
 await fs.writeFile(new URL('admin1-'+name+'.png',out),canvas.toBuffer('image/png'));await fs.writeFile(new URL('admin1-'+name+'.svg',out),result.svg);
}
for(const [provinces,provinceLabels] of [[false,false],[false,true],[true,false]]){
 const svg=renderer.render({...state,settings:{...settings,provinces,provinceLabels}},{svg:true}).svg;
 assert.equal(svg.includes('data-layer="admin1-boundaries"'),provinces);assert.equal(svg.includes('data-layer="admin1-labels"'),provinceLabels);
}
const taiwan=renderer.render({...state,settings:{...settings,mapScope:'taiwan',counties:true},camera:defaultCamera(settings)},{svg:true}).svg;
assert.ok(!taiwan.includes('data-layer="admin1-'));assert.ok(taiwan.includes('stroke="#3e5236"'));
renderer.admin1.state='error';assert.equal(renderer.status(state).adminFailed,true);assert.equal(renderer.status(state).ready,false);
assert.equal(renderer.status({...state,settings:{...settings,provinces:false,provinceLabels:false}}).ready,true,'Disabled optional layer cannot block exports');
console.log('PASS: global coverage/source versions, Taiwan exclusion, viewport culling, lazy request reuse/retry, layer readiness, independent boundaries/names, US/Japan/China bilingual Canvas/SVG and PNG/PDF exports');
