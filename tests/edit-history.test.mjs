import assert from 'node:assert/strict';
import {createHistory} from '../dist/edit-history.mjs';
let state={n:0},data=0,tag=null,flags;
const h=createHistory(()=>state,s=>state=s,{limit:3,dataset:()=>data,group:()=>tag,onChange:(...v)=>flags=v});
for(let n=1;n<=5;n++){state.n=n;h.capture();}
assert.equal(h.undo(),true);assert.equal(state.n,4);h.undo();h.undo();assert.equal(state.n,2);assert.equal(h.undo(),false);
h.redo();assert.equal(state.n,3);state.n=9;h.capture();assert.equal(h.redo(),false);
data++;state.n=0;h.capture();assert.deepEqual(flags,[false,false]);
tag='slider';for(let n=1;n<=4;n++){state.n=n;h.capture();}h.undo();assert.equal(state.n,0);h.redo();assert.equal(state.n,4);
state.n=6;h.schedule();h.undo();assert.equal(state.n,4);await Promise.resolve();assert.equal(h.redo(),true);assert.equal(state.n,6);
console.log('PASS: bounded history, branch invalidation, dataset reset, input coalescing and pending undo');
