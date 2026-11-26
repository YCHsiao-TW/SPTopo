import {tilePlacements,mercatorDomain} from './longitude.mjs';
import {projectedTilePlan,warpTileGrid} from './projected-raster.mjs';
// OSM Standard: only the current human-viewed viewport; no export zoom upgrades,
// offline tile archives, prefetch, cache-busting or anonymous proxy requests.
export const OSM_URL='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_COPYRIGHT='https://www.openstreetmap.org/copyright';
export const OSM_ATTRIBUTION='© OpenStreetMap contributors · '+OSM_COPYRIGHT;
export const OSM_SOURCE='Street basemap: © OpenStreetMap contributors, Open Database License (ODbL), '+OSM_COPYRIGHT+'. OSM Standard tiles: https://tile.openstreetmap.org; current-view static image only, no tile archive. Map labels use source languages. Source detail is independent of export pixel dimensions.';
const MIN_OVERVIEW_ZOOM=3;
const MAX_VIEW_TILES=64;
export function streetTilePlan(camera,p,grid=null){
 // In the live OSM Standard tiles, z3 includes country names in the world overview.
 let z=Math.max(MIN_OVERVIEW_ZOOM,Math.min(19,Math.floor(camera.zoom))),placements;
 if(grid)return {...projectedTilePlan(grid,z,MAX_VIEW_TILES,0),placements:[]};
 while(!(placements=tilePlacements(camera,p,z,MAX_VIEW_TILES)))z--;
 return {z,keys:[...new Set(placements.map(t=>t.key))],placements};
}
export class StreetMap{
 constructor(onChange,{imageFactory=()=>new Image(),maxCache=128}={}){this.onChange=onChange;this.imageFactory=imageFactory;this.maxCache=maxCache;this.tiles=new Map();this.wanted=new Set();this.queue=[];this.running=0;}
 view(camera,p,{request=true,grid=null}={}){
  const plan=streetTilePlan(camera,p,grid);
  if(request){this.wanted=new Set(plan.keys);this.queue=this.queue.filter(t=>{if(this.wanted.has(t.key))return true;this.tiles.delete(t.key);return false;});
   for(const key of plan.keys){let tile=this.tiles.get(key);if(!tile){tile={key,status:'queued'};this.tiles.set(key,tile);this.queue.push(tile);}else{this.tiles.delete(key);this.tiles.set(key,tile);}}
   this.prune();this.pump();
  }
  const tiles=plan.keys.map(key=>this.tiles.get(key)||{key,status:'missing'}),loaded=tiles.filter(t=>t.status==='ready').length,failed=tiles.filter(t=>t.status==='error').length;
  return {...plan,tiles,loaded,failed,ready:loaded===tiles.length};
 }
 prune(){for(const [key,tile] of this.tiles){if(this.tiles.size<=this.maxCache)break;if(!this.wanted.has(key)&&tile.status!=='loading')this.tiles.delete(key);}}
 pump(){while(this.running<4&&this.queue.length){const tile=this.queue.shift();if(!this.wanted.has(tile.key)){this.tiles.delete(tile.key);continue;}this.running++;tile.status='loading';this.load(tile).finally(()=>{this.running--;this.prune();this.onChange();this.pump();});}}
 async load(tile){try{
  const image=this.imageFactory();image.crossOrigin='anonymous';image.referrerPolicy='strict-origin-when-cross-origin';const [z,x,y]=tile.key.split('/');
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{image.onload=image.onerror=null;image.src='';reject(Error('timeout'));},20000);image.onload=()=>{clearTimeout(timer);image.onload=image.onerror=null;resolve();};image.onerror=()=>{clearTimeout(timer);image.onload=image.onerror=null;reject(Error('tile'));};image.src=OSM_URL.replace('{z}',z).replace('{x}',x).replace('{y}',y);});
  // Refuse tainted/error images before they can break all export formats.
  const probe=document.createElement('canvas');probe.width=probe.height=1;const c=probe.getContext('2d');c.drawImage(image,0,0,1,1);c.getImageData(0,0,1,1);
  tile.image=image;tile.status='ready';
 }catch(e){tile.status='error';tile.error=e.message;}}
 pause(){for(const tile of this.queue)this.tiles.delete(tile.key);this.queue=[];this.wanted.clear();}
 retry(){for(const [key,tile] of this.tiles)if(tile.status==='error')this.tiles.delete(key);this.onChange();}
 drawProjected(ctx,p,view,grid){
  const ready=view.tiles.filter(tile=>tile.status==='ready'),frame=this.projectedFrame,key=grid.key+'/'+view.z;
  if(frame?.key!==key||frame.tiles.length!==ready.length||frame.tiles.some((tile,i)=>tile!==ready[i])){
   const pixels=new Map();
   for(const tile of ready){
    if(!tile.pixels){
     const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
     const context=canvas.getContext('2d');context.drawImage(tile.image,0,0,256,256);
     tile.pixels=context.getImageData(0,0,256,256).data;
    }
    pixels.set(tile.key,tile.pixels);
   }
   this.projectedFrame={key,tiles:ready,canvas:warpTileGrid(grid,view.z,pixels,256)};
  }
  ctx.drawImage(this.projectedFrame.canvas,p.x,p.y,p.w,p.h);
 }
 draw(ctx,camera,p,{request=true,exporting=false,scale=1,grid=null}={}){
  const view=this.view(camera,p,{request,grid});if(exporting&&!view.ready)throw Error(view.failed?'OpenStreetMap 街道底圖載入失敗，請重新載入或切回地形底圖。':'街道底圖載入中，完成後即可匯出。');
  if(grid){this.drawProjected(ctx,p,view,grid);return view;}
  ctx.save();ctx.beginPath();const d=mercatorDomain(camera,p);ctx.rect(d.x,d.y,d.w,d.h);ctx.clip();ctx.fillStyle='#edf0eb';ctx.fillRect(p.x,p.y,p.w,p.h);
  const world=256*2**camera.zoom;
  for(const placement of view.placements){const tile=this.tiles.get(placement.key);if(tile?.status!=='ready')continue;const {x,y}=placement,z=view.z,n=2**z;
   const left=Math.round((p.x+p.w/2+(x/n-camera.x)*world)*scale)/scale,top=Math.round((p.y+p.h/2+(y/n-camera.y)*world)*scale)/scale,right=Math.round((p.x+p.w/2+((x+1)/n-camera.x)*world)*scale)/scale,bottom=Math.round((p.y+p.h/2+((y+1)/n-camera.y)*world)*scale)/scale;
   ctx.drawImage(tile.image,left,top,right-left,bottom-top);
  }
  ctx.restore();return view;
 }
}
