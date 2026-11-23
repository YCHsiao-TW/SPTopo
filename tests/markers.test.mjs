import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {MapRenderer,defaultCamera,layout,position} from '../dist/map.mjs';
import {groupSites} from '../dist/core.mjs';
import {MARKER_SHAPES} from '../dist/markers.mjs';

const native=createRequire(import.meta.url)(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'));
globalThis.Path2D=native.Path2D;
globalThis.document={createElement:()=>native.createCanvas(1,1)};
globalThis.fetch=async url=>new Response(await fs.readFile(new URL('../dist/'+url,import.meta.url)));
const canvas=document.createElement('canvas'),renderer=new MapRenderer(canvas,()=>{});await renderer.init();
const settings={mapScope:'world',terrain:false,legend:true,legendTitle:'species',legendSymbol:10,radius:18,autoSize:false,frame:true,countries:false,counties:false,towns:false,pies:true,digits:5,pieMode:'presence'};
const groups=MARKER_SHAPES.map(shape=>'Species '+shape),points=groups.map((group,i)=>({group,lon:-7.5+i%5*3.5,lat:-5+Math.floor(i/5)*2.5}));
const state={settings,language:'en',camera:defaultCamera(settings,[-10,-7,10,7]),sites:groupSites(points),groups,selected:new Set(groups),colors:Object.fromEntries(groups.map(g=>[g,'#0072b2'])),shapes:Object.fromEntries(groups.map((g,i)=>[g,MARKER_SHAPES[i]])),demo:true};
const svg=renderer.render(state,{width:1200,svg:true}).svg,masks=new Set();
for(const [i,shape] of MARKER_SHAPES.entries()){
 const glyphs=[...svg.matchAll(new RegExp(`<g data-marker-shape="${shape}">([\\s\\S]*?)</g>`,'g'))];
 assert.equal(glyphs.length,2,shape+' is used in both the map and legend');
 assert.ok(glyphs.every(g=>g[1].includes(shape==='circle'?'<circle':'<path')));
 const [x,y]=position(points[i].lon,points[i].lat,state.camera,layout(settings)),pixels=canvas.getContext('2d').getImageData(Math.round(x)-23,Math.round(y)-23,46,46).data;
 masks.add(Array.from({length:46*46},(_,j)=>pixels[j*4]<100&&pixels[j*4+2]>100?'1':'0').join(''));
}
assert.equal(masks.size,16,'Identically colored taxa remain visually distinct by their Canvas silhouettes');
assert.ok(svg.includes('markerShapes='));
const piePoints=[...points,{lon:0,lat:5,group:groups[0]},{lon:0,lat:5,group:groups[1]}],pies=renderer.render({...state,sites:groupSites(piePoints)},{svg:true}).svg;
assert.match(pies,/A18,18/,'Co-occurrence still renders circular pie wedges');
const filtered=renderer.render({...state,selected:new Set(groups.slice(1)),sites:groupSites(points.slice(1))},{svg:true}).svg;
assert.ok(!filtered.includes('data-marker-shape="circle"'),'An excluded taxon is removed from both map and legend');
const legacy=renderer.render({...state,shapes:undefined},{svg:true}).svg;
assert.equal([...legacy.matchAll(/data-marker-shape="circle"/g)].length,32,'Older projects default to circles');
const out=new URL('../qa/',import.meta.url);await fs.mkdir(out,{recursive:true});renderer.render(state,{svg:true});await fs.writeFile(new URL('markers.png',out),canvas.toBuffer('image/png'));await fs.writeFile(new URL('markers.svg',out),svg);
console.log('PASS: 16 same-color Canvas silhouettes, shared map/legend SVG shapes, filtered taxa, circular pies and legacy circles');
