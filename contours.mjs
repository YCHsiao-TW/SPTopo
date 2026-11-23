import {project} from './core.mjs';
import {modulo} from './longitude.mjs';
// Marching squares on a fixed logical-pixel grid: export resolution never changes geometry.
export function isolines(values,w,h,p,interval){
 const paths=new Map(),dx=p.w/(w-1),dy=p.h/(h-1);
 for(let y=0;y<h-1;y++)for(let x=0;x<w-1;x++){
  const v=[values[y*w+x],values[y*w+x+1],values[(y+1)*w+x+1],values[(y+1)*w+x]];
  if(!v.every(Number.isFinite))continue;
  const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]];
  for(let level=Math.max(interval,Math.ceil(Math.min(...v)/interval)*interval);level<=Math.max(...v);level+=interval){
   const cross=[];
   for(let a=0;a<4;a++){const b=(a+1)%4;if((v[a]<level)===(v[b]<level))continue;const t=(level-v[a])/(v[b]-v[a]);cross.push([a,p.x+(corners[a][0]+t*(corners[b][0]-corners[a][0]))*dx,p.y+(corners[a][1]+t*(corners[b][1]-corners[a][1]))*dy]);}
   const pairs=cross.length===4?((v[0]-level)*(v[2]-level)-(v[1]-level)*(v[3]-level)>=0?[[0,1],[2,3]]:[[0,3],[1,2]]):cross.length===2?[[0,1]]:[];
   for(const [a,b] of pairs){const A=cross[a],B=cross[b];paths.set(level,(paths.get(level)||'')+`M${A[1].toFixed(2)},${A[2].toFixed(2)}L${B[1].toFixed(2)},${B[2].toFixed(2)}`);}
  }
 }
 return [...paths].map(([level,d])=>({level,d}));
}
export function sampleDEM(tiles,z,lon,lat){
 if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lat)>85.05112878)return NaN;
 const n=2**z,size=n*256,[u,v]=project(lon,lat),px=u*size-.5,py=v*size-.5,x=Math.floor(px),y=Math.floor(py),fx=px-x,fy=py-y;
 const at=(a,b)=>{a=modulo(a,size);b=Math.max(0,Math.min(size-1,b));const t=tiles.get(`${z}/${Math.floor(a/256)}/${Math.floor(b/256)}`);return t?.status==='ready'?t.elev[(b%256)*256+a%256]:NaN;};
 return at(x,y)*(1-fx)*(1-fy)+at(x+1,y)*fx*(1-fy)+at(x,y+1)*(1-fx)*fy+at(x+1,y+1)*fx*fy;
}
export class LandContours{
 paths(key,view,tiles,p,invert,interval=500){
  if(!view.tiles.length||view.tiles.some(t=>t.status!=='ready'))return [];
  const refs=view.tiles.map(t=>t.elev);
  if(this.key===key&&refs.length===this.refs?.length&&refs.every((t,i)=>t===this.refs[i]))return this.result;
  const w=Math.min(600,Math.max(2,Math.ceil(p.w/3)+1)),h=Math.min(600,Math.max(2,Math.ceil(p.h/3)+1)),values=new Float32Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const q=invert(p.x+x*p.w/(w-1),p.y+y*p.h/(h-1));values[y*w+x]=sampleDEM(tiles,view.z,q?.[0],q?.[1]);}
  this.key=key;this.refs=refs;return this.result=isolines(values,w,h,p,interval);
 }
}

// Join the emitted segments before choosing labels, so tiny isolated fragments
// cannot receive a misleading label. Endpoint strings share the path precision.
export function contourChains(d){
 const nodes=new Map(),edges=[];
 const node=(x,y)=>{const key=`${x},${y}`;if(!nodes.has(key))nodes.set(key,{x:+x,y:+y,edges:[]});return nodes.get(key);};
 for(const m of d.matchAll(/M(-?[\d.]+),(-?[\d.]+)L(-?[\d.]+),(-?[\d.]+)/g)){
  const a=node(m[1],m[2]),b=node(m[3],m[4]);if(a===b)continue;const edge={a,b,used:false};a.edges.push(edge);b.edges.push(edge);edges.push(edge);
 }
 const chains=[];
 const walk=(start,edge)=>{const points=[start];let current=start;while(edge&&!edge.used){edge.used=true;current=edge.a===current?edge.b:edge.a;points.push(current);edge=current.edges.find(e=>!e.used);}if(points.length>1)chains.push(points);};
 for(const n of nodes.values())if(n.edges.length!==2)for(const e of n.edges)if(!e.used)walk(n,e);
 for(const e of edges)if(!e.used)walk(e.a,e);
 return chains;
}
export function contourLabels(paths,p,interval,{measure=text=>text.length*6,allowed=()=>true,blocked=[]}={}){
 const labels=[],occupied=[...blocked];
 const ordered=[...paths].sort((a,b)=>Number(b.level%(interval*5)===0)-Number(a.level%(interval*5)===0)||a.level-b.level);
 for(const contour of ordered){
  const text=`${contour.level} m`,w=measure(text)+8;
  for(const chain of contourChains(contour.d)){
   const lengths=chain.slice(1).map((b,i)=>Math.hypot(b.x-chain[i].x,b.y-chain[i].y)),total=lengths.reduce((a,b)=>a+b,0);
   if(total<w+24)continue;
   // Repeat on long lines, but keep all levels spatially separated.
   for(let distance=Math.min(total/2,80);distance<total-12;distance+=300){
    let travel=0,i=0;while(i<lengths.length-1&&travel+lengths[i]<distance)travel+=lengths[i++];
    const a=chain[i],b=chain[i+1],t=(distance-travel)/lengths[i],x=a.x+t*(b.x-a.x),y=a.y+t*(b.y-a.y);
    if(!Number.isFinite(x+y)||x-w/2<p.x+8||x+w/2>p.x+p.w-8||y<p.y+12||y>p.y+p.h-12)continue;
    if(occupied.some(q=>Math.abs(x-q.x)<(w+q.w)/2+36&&Math.abs(y-q.y)<(q.h??18)/2+34))continue;
    if(!allowed(x,y,w))continue;
    labels.push({x,y,w,text,level:contour.level});occupied.push({x,y,w,h:18});
    if(labels.length>=40)return labels;
   }
  }
 }
 return labels;
}
