import assert from 'node:assert/strict';
import {figureCaption,captionColor} from '../dist/caption.mjs';
import {MARKER_SHAPES} from '../dist/markers.mjs';
const state={valid:[{group:'A'},{group:'B'}],groups:['A','B'],selected:new Set(['A']),displayNames:{A:'Quedius masuzoi'},colors:{A:'#0072B2',B:'#D55E00'},shapes:{A:'square',B:'question'},demo:false};
assert.equal(figureCaption(state),'圖 X．Quedius masuzoi的分布。 藍色方形代表Quedius masuzoi。 使用 SPTopo 製圖。');
assert.equal(figureCaption(state,'en'),'Figure X. Distribution of Quedius masuzoi. Quedius masuzoi is represented by blue squares. Map prepared with SPTopo.');
assert.match(figureCaption({...state,demo:true}),/示範資料/);
assert.doesNotMatch(figureCaption(state),/投影|比例|有效紀錄|模式產地|問號/);
assert.match(figureCaption({...state,selected:new Set(['A','B'])},'en'),/B is represented by orange question marks/);
assert.match(figureCaption({...state,colors:{A:'#ff0000'},shapes:{A:'triangle'}}),/紅色正三角形/);
for(const shape of MARKER_SHAPES){for(const lang of ['en','zh-Hant'])assert.doesNotMatch(figureCaption({...state,shapes:{A:shape}},lang),/undefined/);}
assert.match(figureCaption({...state,shapes:{A:'heart'}}),/藍色圓形/);
for(const [hex,name] of [['#ffffff','white'],['#000000','black'],['#808080','gray'],['#00ff00','green'],['#0000ff','blue'],['#ff0000','red']])assert.equal(captionColor(hex,true),name);
assert.doesNotMatch(figureCaption({...state,selected:new Set()}),/represented by/);
const many={...state,groups:undefined,valid:Array.from({length:16},(_,i)=>({group:`G${i}`})),selected:new Set(Array.from({length:16},(_,i)=>`G${i}`))};
assert.match(figureCaption(many,'en'),/G15 is represented by/);
console.log('PASS: bilingual caption, all 16 shapes, current colours, selection, custom labels, legacy fallback and many groups');
