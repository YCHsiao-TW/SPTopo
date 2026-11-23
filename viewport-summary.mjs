import {layout,position} from './map.mjs';
// Count anchors in the same projection and rounded site coordinates as the map.
export function viewportSummary(state){
 const p=layout(state.settings);let total=0,inside=0,sitesInside=0;
 for(const site of state.sites){const n=site.count??site.values.reduce((sum,g)=>sum+g.count,0);total+=n;
  const [x,y]=position(site.lon,site.lat,state.camera,p,state.settings);
  if(Number.isFinite(x)&&Number.isFinite(y)&&x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h){inside+=n;sitesInside++;}
 }
 return {total,inside,outside:total-inside,sitesInside,sitesTotal:state.sites.length};
}
