import {geographicOverlap} from './longitude.mjs';
// Prepared, same-origin vectors. Never query a public OSM API while browsing.
async function readJSON(url){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{
  const response=await fetch(url,{signal:controller.signal});
  if(!response.ok)throw Error('Detail HTTP '+response.status);
  if(!url.endsWith('.gz'))return await response.json();
  const bytes=new Uint8Array(await response.arrayBuffer());
  // Static hosts may already have applied HTTP Content-Encoding.
  if(bytes[0]===0x1f&&bytes[1]===0x8b){
   const content=new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));
   return url.endsWith('.bin.gz')?new Uint8Array(await content.arrayBuffer()):await content.json();
  }
  return url.endsWith('.bin.gz')?bytes:JSON.parse(new TextDecoder().decode(bytes));
 }finally{clearTimeout(timer);}
}
const validBox=b=>Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[0]<=b[2]&&b[1]<=b[3];
const validFile=n=>typeof n==='string'&&/^[\w/-]+\.(?:json(?:\.gz)?|bin\.gz)$/.test(n)&&!n.includes('..');
export class DetailLayers{
 constructor(name,onChange,indexFile='index.json'){this.name=name;this.indexFile=indexFile;this.onChange=onChange;this.index=null;this.indexState='idle';this.files=new Map();this.wanted=[];this.queue=[];this.running=0;}
 async init(){
  if(this.indexState!=='idle')return;this.indexState='loading';
  try{const d=await readJSON(`./assets/${this.name}/${this.indexFile}`);if(!validFile(d.overview)||!d.tiles||Object.values(d.tiles).some(t=>!validBox(t.bbox)||!validFile(t.file)))throw Error('Invalid detail index');this.index=d;this.indexState='ready';}catch{this.indexState='error';}this.onChange();
 }
 plan(camera,bounds,curved=false){
  if(!this.index)return [];
  if(curved||camera.zoom<5||!validBox(bounds))return [this.index.overview];
  const tiles=Object.values(this.index.tiles).filter(t=>geographicOverlap(t.bbox,bounds,false)).map(t=>t.file);
  return tiles.length>24?[this.index.overview]:tiles;
 }
 status(active,camera,bounds,curved=false,{request=true}={}){
  if(!active){if(request){for(const n of this.queue)this.files.delete(n);this.queue=[];this.wanted=[];}return {ready:true,failed:false,pending:false};}
  if(request)this.init();const names=this.plan(camera,bounds,curved);
  if(request&&this.index){this.wanted=names;this.queue=this.queue.filter(n=>{if(names.includes(n))return true;this.files.delete(n);return false;});for(const n of names){const f=this.files.get(n);if(!f){this.files.set(n,{state:'queued'});this.queue.push(n);}else{this.files.delete(n);this.files.set(n,f);}}this.prune();this.pump();}
  const failed=this.indexState==='error'||names.some(n=>this.files.get(n)?.state==='error'),ready=this.indexState==='ready'&&names.every(n=>this.files.get(n)?.state==='ready');return {ready,failed,pending:!ready&&!failed};
 }
 prune(){for(const [n,f] of this.files){if(this.files.size<=24)break;if(!this.wanted.includes(n)&&f.state!=='loading')this.files.delete(n);}}
 prepare(data){return data;}
 pump(){while(this.running<3&&this.queue.length){const n=this.queue.shift(),f=this.files.get(n);f.state='loading';this.running++;(async()=>{
  try{const d=this.prepare(await readJSON(`./assets/${this.name}/${n}`));if(d.type!=='FeatureCollection'||!Array.isArray(d.features)||d.features.some(f=>!validBox(f.bbox)||!f.geometry||!f.properties))throw Error('Invalid detail geometry');f.data=d;f.state='ready';}catch{f.state='error';}finally{this.running--;this.prune();this.onChange();this.pump();}
 })();}}
 data(camera,bounds,curved=false){const names=this.plan(camera,bounds,curved);if(this.indexState!=='ready'||names.some(n=>this.files.get(n)?.state!=='ready'))return null;const features=names.flatMap(n=>this.files.get(n).data.features);return {type:'FeatureCollection',features};}
 retry(){if(this.indexState==='error')this.indexState='idle';for(const [n,f] of this.files)if(f.state==='error')this.files.delete(n);this.onChange();}
}
