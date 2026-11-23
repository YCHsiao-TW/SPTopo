import {boundsOf} from './longitude.mjs';
import {unproject,RAMP,WORLD_RAMP} from './core.mjs';
export const WORLD_REGIONS={bering:[165,50,-145,73],world:[-180,-80,180,80],asia:[25,-15,180,80],westPacific:[95,-50,180,55],europe:[-25,34,45,72],africa:[-20,-36,55,38],americas:[-170,-60,-30,80],oceania:[110,-50,180,5]};
export function worldMode(settings,camera,plot){
 if(settings.mapScope==='world')return true;
 if(settings.mapScope==='taiwan')return false;
 const s=256*2**camera.zoom,a=unproject(camera.x-plot.w/2/s,camera.y+plot.h/2/s),b=unproject(camera.x+plot.w/2/s,camera.y-plot.h/2/s);
 return a[0]<116||b[0]>126||a[1]<20||b[1]>28;
}
export function coordinateLabel(lon,lat){if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>85)return '—';return `${Math.abs(lon).toFixed(5)}° ${lon<0?'W':'E'} / ${Math.abs(lat).toFixed(5)}° ${lat<0?'S':'N'}`;}
export function elevationScale(settings,camera,plot){
 const globalMap=worldMode(settings,camera,plot),ramp=globalMap?WORLD_RAMP:RAMP,max=ramp.at(-1)[0];
 return {ramp,max,ticks:Array.from({length:max/1000+1},(_,i)=>i*1000)};
}
export const BASEMAP_LATITUDE_LIMIT=85;
export function isClippedEdge(a,b){
 // Dataset clipping closes polygons along ±85° and the dateline. These are
 // map-domain edges, rather than actual coastline or country borders.
 // Natural Earth rounds some western cut coordinates to −179.999951171875°.
 return Math.abs(a[1]-b[1])<1e-8&&Math.abs(Math.abs(a[1])-BASEMAP_LATITUDE_LIMIT)<1e-8||Math.abs(a[0]-b[0])<1e-4&&Math.abs(Math.abs(a[0])-180)<1e-4&&Math.abs(Math.abs(b[0])-180)<1e-4;
}
export function outlineGeometry(geometry,point){
 const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates,parts=[];
 if(point.path){const lines=[];for(const polygon of polygons)for(const ring of polygon){let line=[];for(let i=1;i<ring.length;i++){if(isClippedEdge(ring[i-1],ring[i])){if(line.length>1)lines.push(line);line=[];continue;}if(!line.length)line.push(ring[i-1]);line.push(ring[i]);}if(line.length>1)lines.push(line);}return point.path({type:'MultiLineString',coordinates:lines})||'';}
 if(point.copies)return polygons.map(polygon=>point.copies(boundsOf(polygon[0])).map(q=>outlineGeometry({type:'Polygon',coordinates:polygon},q)).join('')).join('');
 for(const polygon of polygons){
  if(point.bounds){const xs=polygon[0].map(a=>a[0]),ys=polygon[0].map(a=>a[1]),b=point.bounds;if(Math.max(...xs)<b[0]||Math.min(...xs)>b[2]||Math.max(...ys)<b[1]||Math.min(...ys)>b[3])continue;}
  for(const ring of polygon){
   let drawing=false;
   for(let i=1;i<ring.length;i++){
    if(isClippedEdge(ring[i-1],ring[i])){drawing=false;continue;}
    const a=point(...ring[i-1]),b=point(...ring[i]);
    if(!drawing)parts.push(`M${a[0].toFixed(2)},${a[1].toFixed(2)}`);
    parts.push(`L${b[0].toFixed(2)},${b[1].toFixed(2)}`);drawing=true;
   }
  }
 }
 return parts.join('');
}
export function polarGaps(camera,plot){
 const scale=256*2**camera.zoom,north=plot.y+plot.h/2+(projectLatitude(BASEMAP_LATITUDE_LIMIT)-camera.y)*scale,south=plot.y+plot.h/2+(projectLatitude(-BASEMAP_LATITUDE_LIMIT)-camera.y)*scale;
 const top=Math.min(plot.y+plot.h,north),bottom=Math.max(plot.y,south),gaps=[];
 if(top>plot.y)gaps.push({x:plot.x,y:plot.y,w:plot.w,h:top-plot.y,edge:'85°N'});
 if(bottom<plot.y+plot.h)gaps.push({x:plot.x,y:bottom,w:plot.w,h:plot.y+plot.h-bottom,edge:'85°S'});
 return gaps;
}
function projectLatitude(lat){return (1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2;}
