import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {labelExclusions,intersectsExclusion} from '../dist/label-exclusions.mjs';
import {countryLabels} from '../dist/country-labels.mjs';
import {MapRenderer,defaultCamera} from '../dist/map.mjs';
const native=createRequire(import.meta.url)(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'));
globalThis.Path2D=native.Path2D;globalThis.document={createElement:()=>native.createCanvas(256,256)};
const ctx=native.createCanvas(300,200).getContext('2d'),p={x:0,y:0,w:300,h:200},rect={left:100,right:200,top:50,bottom:100};
for(const d of ['M140,0L141,0L141,200L140,200Z','M130,70L131,70L131,71L130,71Z','M0,0L300,0L300,200L0,200Z'])assert.ok(intersectsExclusion(ctx,rect,labelExclusions([d])),'crossing, enclosed island and covering polygon');
assert.equal(intersectsExclusion(ctx,rect,labelExclusions(['M0,0L10,0L10,10L0,10Z'])),false);
const land='M0,0L300,0L300,200L0,200Z',items=[{feature:{properties:{name:'Example'}},d:land,anchor:[150,100]}];
assert.equal(countryLabels(ctx,items,p,'en',[],[land]).length,0,'omit when all visible land is excluded');
const partial='M90,0L210,0L210,200L90,200Z',labels=countryLabels(ctx,items,p,'en',[],[partial]);assert.equal(labels.length,1);assert.ok(labels[0].x<90||labels[0].x>210,'relocate outside dispute');
const root=path.resolve('dist');globalThis.fetch=async url=>new Response(await fs.readFile(path.resolve(root,url)));
const renderer=new MapRenderer(document.createElement('canvas'),()=>{});await renderer.init();
assert.equal(renderer.world.disputedAreas.features.length,92);assert.ok(renderer.world.disputedAreas.features.some(f=>f.properties.name==='Crimea'));assert.ok(renderer.world.disputedAreas.features.some(f=>f.properties.name==='Taiwan'));
for(const projection of ['mercator','equalEarth','robinson']){
 const settings={mapScope:'world',projection,terrain:false,legend:false,countries:true,countryLabels:true};
 const state={settings,camera:defaultCamera(settings,[-180,-80,180,80]),sites:[],groups:[],colors:{},language:'en'};
 const svg=renderer.render(state,{svg:true}).svg;assert.ok(svg.includes('data-layer="country-labels"'));assert.ok(!/NaN|Infinity/.test(svg.replace(/data:image\/[^" ]+/g,'')));
}
const settings={mapScope:'world',terrain:false,legend:false,countryLabels:true},state={settings,camera:defaultCamera(settings,[-170,55,-135,72]),sites:[],groups:[],colors:{},language:'en'};
assert.ok(renderer.render(state,{svg:true}).svg.includes('>United States</text>'),'Alaska still gets its country label');
console.log('PASS: full text rectangle exclusion, thin crossings, enclosed polygons, relocation/omission, real source coverage, three projections and Alaska label');
