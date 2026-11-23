import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {MapRenderer,defaultCamera,layout} from '../dist/map.mjs';
import {placeName} from '../dist/place-names.mjs';
import {COUNTRY_PRESETS} from '../dist/country-presets.mjs';
import {sortedCountries,OCEAN_REGIONS} from '../dist/quick-regions.mjs';

assert.equal(COUNTRY_PRESETS.length,242);assert.equal(new Set(COUNTRY_PRESETS.map(c=>c.id)).size,242);assert.equal(Object.keys(OCEAN_REGIONS).length,7);
for(const {bounds:b} of COUNTRY_PRESETS){assert.ok(b.every(Number.isFinite));assert.ok(b[0]>=-180&&b[0]<=180&&b[2]>=-180&&b[2]<=180&&b[0]!==b[2]);assert.ok(b[1]>=-85&&b[3]<=85&&b[1]<b[3]);}
const countries=sortedCountries('zh-Hant');for(let i=1;i<countries.length;i++)assert.ok(countries[i-1].english.localeCompare(countries[i].english,'en')<=0);
assert.equal(placeName(countries.find(c=>c.id==='country_NPL'),'zh-Hant'),'尼泊爾');assert.equal(placeName(countries.find(c=>c.id==='country_CHN'),'zh-Hant'),'中國');
const require=createRequire(import.meta.url),native=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'));
globalThis.Path2D=native.Path2D;globalThis.document={createElement:()=>native.createCanvas(256,256)};
const root=path.resolve('dist');globalThis.fetch=async url=>new Response(await fs.readFile(path.resolve(root,url)));
const canvas=document.createElement('canvas'),renderer=new MapRenderer(canvas,()=>{});await renderer.init();await renderer.water.load('bathymetry');
const settings={mapScope:'world',terrain:false,ocean:true,legend:false,countries:true,countryLabels:true,frame:true};
const state={settings,camera:defaultCamera(settings,[80,25,94,31]),sites:[],groups:[],colors:{},language:'zh-Hant'};
const svg=renderer.render(state,{svg:true}).svg;
for(const name of ['印度','尼泊爾','不丹','中國'])assert.ok(svg.includes('>'+name+'</text>'),name+' visible in Himalaya view');
assert.ok(!svg.includes('尼泊尔'));await fs.writeFile('docs/sptopo-himalaya-labels.svg',svg);
for(const mapScope of ['auto','world']){
 const s={...state,settings:{...settings,mapScope,countryLabels:false},camera:defaultCamera(settings,[120.5,24.5,122,25.5])};
 renderer.render(s);const p=layout(s.settings),c=canvas.getContext('2d');let white=0;for(let y=p.y+3;y<p.y+p.h-3;y+=3)for(let x=p.x+3;x<p.x+p.w-3;x+=3){const v=c.getImageData(x,y,1,1).data;if(v[0]>250&&v[1]>250&&v[2]>250)white++;}assert.equal(white,0,'no unpainted white seams with '+mapScope+' land/ocean mask');
 await fs.writeFile('docs/sptopo-coast-'+mapScope+'.png',canvas.toBuffer('image/png'));
}
console.log('PASS: all quick-location bounds/order, traditional names, four Himalaya labels, no white seams with regional and global coastline masks');
