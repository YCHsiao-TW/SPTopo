import {project} from './core.mjs';
import {projector} from './projection.mjs';
export function projectedTilePlan(grid,zoom,limit,padding=1){
 const viewKey=[zoom,limit,padding].join('/'),stored=grid.views.get(viewKey);
 if(stored)return stored;
 let z=zoom,keys;
 for(;;z--){
  const n=2**z,core=new Set(),padded=new Set();
  for(let i=0;i<grid.uv.length;i+=2){const u=grid.uv[i],v=grid.uv[i+1];if(Number.isFinite(u))core.add(Math.min(n-1,Math.floor(v*n))*n+Math.min(n-1,Math.floor(u*n)));}
  // The DEM needs a halo. Street imagery uses only tiles visible in the viewport.
  for(const index of core){const x=index%n,y=Math.floor(index/n);for(let dy=-padding;dy<=padding;dy++)for(let dx=-padding;dx<=padding;dx++){const yy=y+dy;if(yy>=0&&yy<n)padded.add(yy*n+(x+dx+n)%n);}}
  keys=[...padded].map(index=>`${z}/${index%n}/${Math.floor(index/n)}`);
  if(keys.length<=limit||z===0)break;
 }
 const plan={z,keys:keys.sort()};grid.views.set(viewKey,plan);return plan;
}
export function warpTileGrid(grid,z,pixels,size=258){
 const canvas=document.createElement('canvas');canvas.width=grid.w;canvas.height=grid.h;
 const ctx=canvas.getContext('2d'),out=ctx.createImageData(grid.w,grid.h),n=2**z,offset=(size-256)/2-.5;
 for(let i=0;i<grid.w*grid.h;i++){
  const u=grid.uv[i*2],v=grid.uv[i*2+1];if(!Number.isFinite(u))continue;
  const tx=Math.min(n-1,Math.floor(u*n)),ty=Math.min(n-1,Math.floor(v*n)),data=pixels.get(`${z}/${tx}/${ty}`);if(!data)continue;
  const px=Math.max(0,Math.min(size-1.001,u*n*256-tx*256+offset)),py=Math.max(0,Math.min(size-1.001,v*n*256-ty*256+offset)),x=Math.floor(px),y=Math.floor(py),fx=px-x,fy=py-y,a=(y*size+x)*4,b=a+4,d=a+size*4,e=d+4;
  for(let k=0;k<3;k++)out.data[i*4+k]=(data[a+k]*(1-fx)+data[b+k]*fx)*(1-fy)+(data[d+k]*(1-fx)+data[e+k]*fx)*fy;
  out.data[i*4+3]=255;
 }
 ctx.putImageData(out,0,0);return canvas;
}
// Inverse-map DEM textures into the selected map projection. A finite raster
// budget controls export memory; it does not imply finer DEM observations.
export class ProjectedRaster{
 constructor(terrain){this.terrain=terrain;this.grids=new Map();this.frames=new Map();}
 grid(state,p,scale=1){
  const desired=state.interacting?360:Math.min(2000,p.w*Math.max(1,scale)),ratio=p.h/p.w,w=Math.max(16,Math.round(Math.min(desired,Math.sqrt(2000000/ratio)))),h=Math.max(16,Math.round(w*ratio)),key=[state.settings.projection,state.camera.x,state.camera.y,state.camera.zoom,p.x,p.y,p.w,p.h,w,h].join('/');
  if(this.grids.has(key))return this.grids.get(key);
  const point=projector(state.settings,state.camera,p),uv=new Float32Array(w*h*2);uv.fill(NaN);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const q=point.invert(p.x+(x+.5)*p.w/w,p.y+(y+.5)*p.h/h);if(!q||Math.abs(q[1])>85)continue;const v=project(...q),i=(y*w+x)*2;uv[i]=Math.max(0,Math.min(1-1e-9,v[0]));uv[i+1]=Math.max(0,Math.min(1-1e-9,v[1]));}
  const grid={key,w,h,uv,views:new Map()};this.grids.set(key,grid);if(this.grids.size>3)this.grids.delete(this.grids.keys().next().value);return grid;
 }
 visible(state,p,plan,scale=1){
  const grid=this.grid(state,p,scale),{z,keys}=projectedTilePlan(grid,plan.zoom,plan.limit);
  return {z,tiles:keys.map(k=>this.terrain.request(k)),grid};
 }
 draw(ctx,state,p,scale,ramp,plan){
  const view=this.visible(state,p,plan,scale),{grid}=view,ready=view.tiles.filter(t=>t.status==='ready'),colors=new Map(),references=[];
  for(const tile of ready){const canvas=this.terrain.color(tile,state.settings,ramp),entry=tile.colors.get(ramp);colors.set(tile.key,canvas);references.push(entry);}
  const key=grid.key+'/'+view.z+'/'+(ramp===undefined?'default':ramp.at(-1)?.join(','));let frame=this.frames.get(key);
  if(!frame||frame.references.length!==references.length||references.some((v,i)=>v!==frame.references[i])){
   const pixels=new Map([...colors].map(([key,c])=>[key,c.getContext('2d').getImageData(0,0,258,258).data]));
   frame={canvas:warpTileGrid(grid,view.z,pixels),references};this.frames.set(key,frame);if(this.frames.size>3)this.frames.delete(this.frames.keys().next().value);
  }
  ctx.imageSmoothingEnabled=true;ctx.drawImage(frame.canvas,p.x,p.y,p.w,p.h);return view;
 }
}
