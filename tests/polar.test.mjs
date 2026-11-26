import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {isClippedEdge,outlineGeometry,polarGaps,WORLD_REGIONS} from '../dist/world.mjs';
import {MapRenderer,defaultCamera,layout} from '../dist/map.mjs';
import {PAGE_PRESETS} from '../dist/page.mjs';
import {pngBlob,pdfBlob} from '../dist/export.mjs';

assert.equal(isClippedEdge([-30,-85],[30,-85]),true);
assert.equal(isClippedEdge([180,-80],[180,-70]),true);
assert.equal(isClippedEdge([-30,-75],[30,-75]),false);
assert.equal(isClippedEdge([-30,-85],[-30,-70]),false);
const clipped={type:'Polygon',coordinates:[[[-30,-85],[-30,-70],[30,-70],[30,-85],[-30,-85]]]};
assert.equal(outlineGeometry(clipped,(x,y)=>[x,y]),'M-30.00,-85.00L-30.00,-70.00L30.00,-70.00L30.00,-85.00');
const world=JSON.parse(await fs.readFile(new URL('../dist/assets/world-countries.geojson',import.meta.url),'utf8'));
const antarctica=world.features.find(f=>f.properties.iso==='ATA');assert.ok(antarctica);
const outline=outlineGeometry(antarctica.geometry,(x,y)=>[x,y]);let previous,coast=0;
for(const m of outline.matchAll(/([ML])(-?[\d.]+),(-?[\d.]+)/g)){
 const p=[Number(m[2]),Number(m[3])];
 if(m[1]==='L'){assert.equal(isClippedEdge(previous,p),false,'Actual Antarctic outlines omit artificial dataset closure edges');coast++;}
 previous=p;
}
assert.ok(coast>500,'Actual coastlines remain visible');
for(const [pageWidth,pageHeight] of Object.values(PAGE_PRESETS)){
 const s={legend:true,pageWidth,pageHeight},p=layout(s),camera=defaultCamera(s,WORLD_REGIONS.world);
 for(const gap of polarGaps(camera,p)){assert.ok(gap.h>0&&gap.x===p.x&&gap.w===p.w);assert.ok(gap.y>=p.y-1e-8&&gap.y+gap.h<=p.y+p.h+1e-8);}
}
assert.equal(polarGaps(defaultCamera({}),layout({})).length,0,'Taiwan/local maps have no polar band');

const require=createRequire(import.meta.url),native=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'):'@napi-rs/canvas');
globalThis.Path2D=native.Path2D;globalThis.document={createElement(){const c=native.createCanvas(1,1);c.toBlob=cb=>cb(new Blob([c.toBuffer('image/png')],{type:'image/png'}));return c;}};
globalThis.fetch=async url=>new Response(await fs.readFile(new URL('../dist/'+url,import.meta.url)));
const canvas=document.createElement('canvas'),renderer=new MapRenderer(canvas,()=>{});await renderer.init();
const settings={mapScope:'world',terrain:false,legend:true,frame:true,countries:true},base={settings,camera:defaultCamera(settings,WORLD_REGIONS.world),sites:[],groups:[],colors:{},demo:false};
const out=new URL('../qa/',import.meta.url);await fs.mkdir(out,{recursive:true});
for(const [language,text] of [['en','Beyond 85°S: outside basemap coverage'],['zh-Hant','85°S 以外：超出目前底圖範圍']]){
 const result=renderer.render({...base,language},{width:1500,svg:true});
 assert.ok(result.svg.includes('data-layer="polar-coverage"'));assert.ok(result.svg.includes(text));assert.ok(result.svg.includes('Dataset cut edges are not coastlines'));
 assert.ok((await pngBlob(canvas,'Polar coverage QA')).size>1000);assert.ok(pdfBlob(canvas,'Polar coverage QA').size>1000);
 await fs.writeFile(new URL('polar-'+language+'.png',out),canvas.toBuffer('image/png'));await fs.writeFile(new URL('polar-'+language+'.svg',out),result.svg);
}
const local=renderer.render({...base,camera:defaultCamera(settings,[119.5,21.6,122.25,25.55])},{svg:true});
assert.ok(!local.svg.includes('data-layer="polar-coverage"'));
console.log('PASS: real Antarctic coastline preserved, artificial 85°/dateline edges omitted, bounded polar bands across page presets, bilingual Canvas/SVG, PNG/PDF and unchanged local maps');
