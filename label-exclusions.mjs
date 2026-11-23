import {pathVertices} from './map-recipe.mjs';
// Screen-space polygon/rectangle intersection. Edge tests catch thin polygons
// crossing the text between sample points, and islands wholly inside the text.
export function labelExclusions(paths){return paths.filter(Boolean).map(d=>{const rings=pathVertices(d).map(p=>p.points).filter(p=>p.length>2),points=rings.flat();return {mask:new Path2D(d),rings,left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))};});}
function segmentHits(a,b,r){let lo=0,hi=1;for(const [v,d,min,max] of [[a[0],b[0]-a[0],r.left,r.right],[a[1],b[1]-a[1],r.top,r.bottom]]){if(!d){if(v<min||v>max)return false;continue;}let t=(min-v)/d,u=(max-v)/d;if(t>u)[t,u]=[u,t];lo=Math.max(lo,t);hi=Math.min(hi,u);if(lo>hi)return false;}return true;}
export function intersectsExclusion(ctx,rect,areas){return areas.some(a=>{
 if(rect.right<a.left||rect.left>a.right||rect.bottom<a.top||rect.top>a.bottom)return false;
 for(const x of [rect.left,rect.right])for(const y of [rect.top,rect.bottom])if(ctx.isPointInPath(a.mask,x,y,'evenodd'))return true;
 return a.rings.some(ring=>ring.some((p,i)=>segmentHits(p,ring[(i+1)%ring.length],rect)));
});}
