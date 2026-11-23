import assert from 'node:assert/strict';
import {contourChains,contourLabels} from '../dist/contours.mjs';
const paths=[{level:200,d:'M20,50L60,50M100,50L60,50M100,50L180,50M180,50L280,50'},{level:1000,d:'M20,55L280,55'},{level:400,d:'M10,10L12,12'}],p={x:0,y:0,w:300,h:200};
assert.equal(contourChains(paths[0].d).length,1);
assert.equal(contourChains(paths[0].d)[0].length,5);
const labels=contourLabels(paths,p,200);
assert.ok(labels.length>0);assert.equal(labels[0].level,1000,'index contours get first placement');
assert.ok(labels.every(l=>l.text===`${l.level} m`));assert.ok(labels.every(l=>l.level!==400),'short fragments unlabelled');
for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){const a=labels[i],b=labels[j];assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2+14||Math.abs(a.y-b.y)>=27);}
assert.equal(contourLabels(paths,p,200,{allowed:()=>false}).length,0,'land eligibility enforced');
assert.equal(contourLabels(paths,p,200,{blocked:[{x:150,y:50,w:300,h:50}]}).length,0,'sample points avoided');
assert.equal(contourLabels([{level:200,d:'M0,0L10,0M100,100L110,100'}],p,200).length,0,'disconnected short segments do not combine');
console.log('PASS: contour joining, level labels, major priority, spacing, land and point exclusions, short fragments');
