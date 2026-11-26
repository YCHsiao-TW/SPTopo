import {eastwardBounds} from './longitude.mjs';
import {streetBasemap} from './basemap-settings.mjs';
import {project,unproject,fitCamera} from './core.mjs';
import {geoEqualEarth,geoRobinson,geoPath,geoGraticule,geoCircle,geoDistance} from './vendor/geo.mjs';
export const PROJECTIONS=['mercator','equalEarth','robinson'];
export function projected(s){return ['equalEarth','robinson'].includes(s.projection);}
const cache=new Map(),wrap=x=>((x+180)%360+360)%360-180;
export function projector(s,camera,p){
 const key=[s.projection,camera.x,camera.y,camera.zoom,p.x,p.y,p.w,p.h].join('/');if(cache.has(key))return cache.get(key);
 const [lon,lat]=unproject(camera.x,camera.y),pr=(s.projection==='robinson'?geoRobinson:geoEqualEarth)().rotate([-lon,0]).scale(256*2**camera.zoom/(2*Math.PI)).translate([0,0]).precision(.2),center=pr([lon,lat]);
 pr.translate([p.x+p.w/2-center[0],p.y+p.h/2-center[1]]);
 const rawInvert=pr.invert.bind(pr),point=(lon,lat)=>pr([lon,lat]);
 point.invert=(x,y)=>{const q=rawInvert([x,y]);if(!q||!q.every(Number.isFinite)||Math.abs(q[1])>90+1e-6)return null;const test=pr(q);return Math.hypot(test[0]-x,test[1]-y)<.05?q:null;};
 point.projection=pr;point.path=geoPath(pr.clipExtent([[p.x,p.y],[p.x+p.w,p.y+p.h]])).digits(2);point.bounds=[-180,-85,180,85];
 point.domain=()=>point.path({type:'Sphere'});
 cache.set(key,point);if(cache.size>8)cache.delete(cache.keys().next().value);return point;
}
export function fitProjection(s,bounds,p,centerLongitude){
 const legacy=fitCamera(bounds,p.w,p.h);if(!projected(s,legacy,p))return legacy;
 const [west,south,east,north]=eastwardBounds(bounds),lon=centerLongitude??(west+east)/2,lat=(north+south)/2;
 let camera={x:project(wrap(lon),lat)[0],y:project(lon,lat)[1],zoom:1};
 const point=projector(s,camera,p),samples=[];
 // Sampling interior latitudes includes the widest part of curved meridians.
 for(let j=0;j<=24;j++)for(let i=0;i<=48;i++)samples.push(point(west+(east-west)*i/48,south+(north-south)*j/24));
 if(east-west>=350){for(let j=0;j<=36;j++)for(const edge of [-179.999,179.999])samples.push(point(wrap(lon+edge),-90+j*5));}
 const dx=Math.max(...samples.map(a=>Math.abs(a[0]-p.x-p.w/2)))*2,dy=Math.max(...samples.map(a=>Math.abs(a[1]-p.y-p.h/2)))*2;
 camera.zoom=Math.max(1,Math.min(17,1+Math.log2(Math.min(p.w/Math.max(1e-9,dx),p.h/Math.max(1e-9,dy))*.88)));
 return camera;
}
export function anchorCamera(s,camera,p,coordinate,target,zoom=camera.zoom){
 if(!coordinate)return {...camera,zoom};
 let [lon,lat]=unproject(camera.x,camera.y),result={...camera,zoom},best=result,bestError=Infinity;
 if(!projector(s,result,p).invert(...target))return result;
 // Solve in geographic coordinates so dragging and wheel zoom retain the
 // same geographic anchor even on curved meridians and across the dateline.
 for(let i=0;i<8;i++){
  result={x:project(wrap(lon),lat)[0],y:project(lon,lat)[1],zoom};const point=projector(s,result,p),q=point(...coordinate),ex=target[0]-q[0],ey=target[1]-q[1],error=Math.hypot(ex,ey);if(error<bestError){best=result;bestError=error;}if(error<.02)return result;
  const step=.0001,lonCam={...result,x:project(wrap(lon+step),lat)[0]},latCam={...result,y:project(lon,Math.min(85,lat+step))[1]},a=projector(s,lonCam,p)(...coordinate),b=projector(s,latCam,p)(...coordinate),ax=(a[0]-q[0])/step,ay=(a[1]-q[1])/step,bx=(b[0]-q[0])/step,by=(b[1]-q[1])/step,det=ax*by-ay*bx;
  if(Math.abs(det)<1e-8)break;lon+=Math.max(-40,Math.min(40,(ex*by-ey*bx)/det));lat=Math.max(-84.99,Math.min(84.99,lat+Math.max(-20,Math.min(20,(ax*ey-ay*ex)/det))));
 }
 return best;
}
export function projectionSource(s,camera,p){const [lon]=unproject(camera.x,camera.y);return projected(s,camera,p)?`Projection: ${s.projection==='robinson'?'Robinson (compromise)':'Equal Earth (equal area)'}; central meridian ${lon.toFixed(5)} degrees; WGS84 geographic input; reprojected ${streetBasemap(s)?'OSM street':'terrain'} raster. Local scale varies across the map.`:'Projection: Web Mercator (EPSG:3857); WGS84 geographic input.';}
export {geoGraticule,geoCircle,geoDistance};
