import assert from 'node:assert/strict';
import {viewportSummary} from '../dist/viewport-summary.mjs';
import {defaultCamera} from '../dist/map.mjs';
const settings={pageWidth:25,pageHeight:20,legendPosition:'right',projection:'mercator',mapScope:'world'};
const state={settings,camera:defaultCamera(settings,[118,21,123,26]),sites:[{lon:121,lat:24,count:3},{lon:-74,lat:40,count:2}]};
assert.deepEqual(viewportSummary(state),{total:5,inside:3,outside:2,sitesInside:1,sitesTotal:2});
for(const projection of ['mercator','equalEarth','robinson']){
 const s={...settings,projection},world={settings:s,camera:defaultCamera(s,[-180,-80,180,80]),sites:state.sites};
 assert.equal(viewportSummary(world).inside,5,projection);
}
assert.deepEqual(viewportSummary({...state,sites:[]}),{total:0,inside:0,outside:0,sitesInside:0,sitesTotal:0});
console.log('PASS: duplicate records vs sites, local clipping, all projections and empty selection');
