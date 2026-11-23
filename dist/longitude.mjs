// Source coordinates remain unchanged. Only display geometry is unwrapped.
export const modulo=(x,n)=>((x%n)+n)%n;
export const wrapLongitude=x=>modulo(x+180,360)-180;
export const wrapUnit=x=>modulo(x,1);
export function nearUnit(x,center){const d=x-center;return Math.abs(d)<=.5?x:x-Math.floor(d+.5);}
export function eastwardBounds([w,s,e,n]){return [w,s,e<w?e+360:e,n];}
export function longitudeCopies(w,e,vw,ve){const out=[];for(let k=Math.ceil((vw-e)/360);k<=Math.floor((ve-w)/360);k++)out.push(k*360);return out;}
export function geographicOverlap(a,b,touch=true){
 if(!b)return true;const aa=eastwardBounds(a),bb=eastwardBounds(b);
 if(touch)return a[1]<=b[3]&&a[3]>=b[1]&&Math.ceil((bb[0]-aa[2])/360)<=Math.floor((bb[2]-aa[0])/360);
 return a[1]<b[3]&&a[3]>b[1]&&Math.floor((bb[0]-aa[2])/360)+1<=Math.ceil((bb[2]-aa[0])/360)-1;
}
// Keep the existing overview margins, showing at most one complete world.
export function mercatorDomain(camera,p){const w=Math.min(p.w,256*2**camera.zoom);return {...p,x:p.x+(p.w-w)/2,w};}
export function mercatorBounds(camera,p){const scale=256*2**camera.zoom,d=mercatorDomain(camera,p),lat=y=>Math.atan(Math.sinh(Math.PI*(1-2*y)))*180/Math.PI;return [(camera.x-d.w/2/scale)*360-180,lat(camera.y+p.h/2/scale),(camera.x+d.w/2/scale)*360-180,lat(camera.y-p.h/2/scale)];}
export function boundsOf(points){let w=Infinity,s=Infinity,e=-Infinity,n=-Infinity;for(const [x,y] of points){w=Math.min(w,x);e=Math.max(e,x);s=Math.min(s,y);n=Math.max(n,y);}return [w,s,e,n];}
export function tilePlacements(camera,p,z,limit=Infinity){
 const world=256*2**camera.zoom,d=mercatorDomain(camera,p),n=2**z,left=camera.x-d.w/2/world,right=camera.x+d.w/2/world,top=camera.y-p.h/2/world,bottom=camera.y+p.h/2/world;
 const x0=Math.floor(left*n),x1=Math.ceil(right*n)-1,y0=Math.max(0,Math.floor(top*n)),y1=Math.min(n-1,Math.ceil(bottom*n)-1);
 // Check the budget before allocating, including old high-zoom settings.
 if(Math.min(n,x1-x0+1)*Math.max(0,y1-y0+1)>limit)return null;
 const placements=[];for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)placements.push({key:`${z}/${modulo(x,n)}/${y}`,x,y});return placements;
}

// Keep the rectangular Mercator viewport inside the DEM latitude coverage.
// The minimum scale fills the frame; vertical panning stops at 85° N/S.
export function boundedMercatorCamera(camera,p){
 const edge=(1-Math.log(Math.tan(Math.PI/4+85*Math.PI/360))/Math.PI)/2;
 const zoom=Math.max(camera.zoom,Math.log2(Math.max(p.w,p.h/(1-2*edge))/256));
 const half=p.h/(2*256*2**zoom),low=edge+half,high=1-edge-half;
 return {...camera,x:wrapUnit(camera.x),zoom,y:low>high?.5:Math.max(low,Math.min(high,camera.y))};
}
