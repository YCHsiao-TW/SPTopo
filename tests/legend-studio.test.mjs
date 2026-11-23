import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {MapRenderer,defaultCamera,layout} from '../dist/map.mjs';
import {legendBlocks,moveLegend,LEGEND_FLAGS} from '../dist/legend.mjs';
import {groupSites} from '../dist/core.mjs';
import {pngBlob,pdfBlob} from '../dist/export.mjs';
import {prepareLegendFonts,labelFont} from '../dist/label-fonts.mjs';
const native=createRequire(import.meta.url)(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'));
globalThis.Path2D=native.Path2D;globalThis.document={createElement(){const c=native.createCanvas(1,1);c.toBlob=f=>f(new Blob([c.toBuffer('image/png')],{type:'image/png'}));return c;}};globalThis.fetch=async url=>new Response(await fs.readFile(new URL('../dist/'+url,import.meta.url)));
const canvas=document.createElement('canvas'),renderer=new MapRenderer(canvas,()=>{});await renderer.init();
// Legend tests isolate typography/layout from networked DEM and water downloads.
renderer.terrain.visible=()=>({z:1,tiles:[],placements:[]});renderer.water.load=()=>Promise.resolve();renderer.water.data=()=>null;
const settings={mapScope:'world',terrain:true,bathymetry:true,rivers:true,lakes:true,legend:true,legendSpecies:true,legendElevation:true,legendDepth:true,legendWater:true,legendFont:13,italic:true,radius:7,autoSize:false,countries:true,frame:true},groups=['Taxon A','Taxon B'],state={settings,language:'en',groups,selected:new Set(groups),colors:{'Taxon A':'#0072b2','Taxon B':'#d55e00'},shapes:{'Taxon A':'star5','Taxon B':'hexagon'},sites:groupSites([{lon:121,lat:23,group:'Taxon A'},{lon:122,lat:24,group:'Taxon B'}]),camera:defaultCamera(settings,[116,15,135,34]),legendEdits:{},displayNames:{},demo:true};
const all=renderer.render(state,{svg:true}).svg;for(const kind of Object.keys(LEGEND_FLAGS).filter(k=>k!=='biomes'))assert.ok(all.includes(`data-legend="${kind}"`));
for(const [kind,flag] of Object.entries(LEGEND_FLAGS).filter(([k])=>k!=='biomes')){
 const hidden=renderer.render({...state,settings:{...settings,[flag]:false}},{svg:true}).svg;
 assert.ok(!hidden.includes(`data-legend="${kind}"`));for(const other of Object.keys(LEGEND_FLAGS).filter(k=>k!=='biomes').filter(k=>k!==kind))assert.ok(hidden.includes(`data-legend="${other}"`));assert.ok(hidden.includes('data-marker-shape="star5"'),'Map markers remain when a legend is hidden');
}
const noLegend=renderer.render({...state,settings:{...settings,legend:false}},{svg:true}).svg;assert.ok(!noLegend.includes('data-legend='));assert.ok(noLegend.includes('data-marker-shape="star5"'));
const edited={...state,displayNames:{'Taxon A':'Visible <&>'},legendEdits:{taxa:{x:10,y:8,font:18,titleFont:21,family:'mono',bold:true,italic:false,titleItalic:true,titleBold:false,title:'Custom <&>',background:true,border:true,gap:42},depth:{x:78,y:42,font:18,scaleHeight:220,family:'sans',italic:true},elevation:{font:24,titleFont:28},water:{font:24}}};
const result=renderer.render(edited,{width:1500,svg:true}),boxes=structuredClone(renderer.legendBoxes),taxa=result.svg.match(/<g data-legend="taxa">([\s\S]*?)<\/g><\/g>/)?.[0]||result.svg;
assert.ok(result.svg.includes('Custom &lt;&amp;&gt;'));assert.ok(result.svg.includes('Visible &lt;&amp;&gt;'));assert.ok(result.svg.includes('font-family="monospace"'));assert.match(taxa,/font-style="normal" font-weight="600"[^>]*>Visible &lt;&amp;&gt;/);assert.equal(boxes.find(b=>b.kind==='depth').barHeight,220);
for(const box of boxes){assert.ok(box.x>=0&&box.y>=0);assert.ok(box.x+box.w<=1200);assert.ok(box.y+box.h<=960);}
renderer.render(edited,{width:3000,svg:true});assert.deepEqual(renderer.legendBoxes,boxes,'Export pixel density does not change logical legend positions or fonts');assert.ok((await pngBlob(canvas,'Legend studio QA')).size>1000);assert.ok(pdfBlob(canvas,'Legend studio QA').size>1000);
const moved=moveLegend(boxes[0],1e6,-1e6,settings),newBoxes=legendBlocks(settings,2,layout(settings),{...edited.legendEdits,taxa:{...edited.legendEdits.taxa,...moved}}),b=newBoxes.find(b=>b.kind==='taxa');assert.equal(b.y,2);assert.ok(b.x+b.w<=1200);
for(const position of ['left','right','top-left','bottom-right','custom'])for(const [pageWidth,pageHeight] of [[25,20],[18,32],[32,9]]){const s={...settings,legendPosition:position,pageWidth,pageHeight},blocks=legendBlocks(s,30,layout(s),{taxa:{font:24,titleFont:36,gap:70,columns:3}});assert.ok(blocks.every(b=>b.x>=0&&b.y>=0&&Number.isFinite(b.h)));}
const out=new URL('../qa/',import.meta.url);await fs.mkdir(out,{recursive:true});renderer.render(edited,{width:1500,svg:true});await fs.writeFile(new URL('legend-studio.png',out),canvas.toBuffer('image/png'));await fs.writeFile(new URL('legend-studio.svg',out),result.svg);
console.log('PASS: four independent legend switches, unchanged markers, escaped display names/titles, separate typography and positions, export density invariance, bounded dragging, page layouts and PNG/PDF');

// Use the same font bytes as the browser, with native Canvas for glyph rendering.
globalThis.FontFace=class {
 constructor(alias,bytes){this.alias=alias;this.bytes=bytes;}
 async load(){
  assert.ok(native.GlobalFonts.register(Buffer.from(this.bytes),this.alias));
  return this;
 }
};
document.fonts={add(){}};
const authority='García, Øster, Černý, Groß ẞ, Cœur, Dağı, Șerban (♂♀ ± β)';
const unicode={...state,displayNames:{'Taxon A':authority}};
await prepareLegendFonts(unicode);
const unicodeMap=renderer.render(unicode,{width:1500,svg:true});
assert.ok(unicodeMap.svg.includes(authority));
assert.ok(unicodeMap.svg.includes('font-family="SPTopo-LiberationSerif-Italic, Georgia"'));
assert.match(unicodeMap.svg,/@font-face[^}]*data:font\/ttf;base64,/);
const glyphCanvas=native.createCanvas(60,60),glyph=glyphCanvas.getContext('2d');
glyph.font='italic 32px '+labelFont('ẞ','Georgia',true,'normal');
const pixels=text=>{
 glyph.clearRect(0,0,60,60);
 glyph.fillText(text,6,36);
 return Buffer.from(glyph.getImageData(0,0,60,60).data);
};
assert.notDeepEqual(pixels('ẞ'),pixels(''));
assert.notDeepEqual(pixels('ẞ'),pixels('?'));
console.log('PASS: accented and scientific legend text uses a packaged font, ẞ has visible glyph pixels, SVG embeds the font');

const species='Araneus diadematus',authorship=' (Linné, 1758)';
const mixed={...state,displayNames:{'Taxon A':species+authorship},legendEdits:{taxa:{nameRuns:{
 'Taxon A':[{text:species,italic:null},{text:authorship,italic:false}]
}}}};
await prepareLegendFonts(mixed);
const mixedMap=renderer.render(mixed,{width:1500,svg:true});
assert.match(mixedMap.svg,/<text [^>]*xml:space="preserve"><tspan [^>]*font-style="italic">Araneus diadematus<\/tspan><tspan [^>]*font-style="normal"> \(Linné, 1758\)<\/tspan><\/text>/);
assert.match(mixedMap.svg,/SPTopo-LiberationSerif-Regular, Georgia/);
assert.ok((await pngBlob(canvas,'Mixed legend')).size>1000);
assert.ok(pdfBlob(canvas,'Mixed legend').size>1000);
console.log('PASS: mixed legends preserve separate styles, names and source spacing in SVG, PNG and PDF');
