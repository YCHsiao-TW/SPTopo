import {DetailLayers} from './detail-layers.mjs';
import {mercatorBounds,geographicOverlap,modulo} from './longitude.mjs';
import {projected,projector} from './projection.mjs';
import {unproject} from './core.mjs';

export const FRESHWATER_RELEASE='2026-11-18.0';
export const FRESHWATER_CREDIT='© OpenStreetMap contributors';
export const FRESHWATER_COPYRIGHT='https://www.openstreetmap.org/copyright';
export const FRESHWATER_SOURCE='Freshwater: '+FRESHWATER_CREDIT+', ODbL 1.0, '+FRESHWATER_COPYRIGHT+'. Overture Maps base/water '+FRESHWATER_RELEASE+'.';
export const FRESHWATER_STYLE={
 'seasonal-area':{fill:'#c1dce5'}, area:{fill:'#90c4d5'},
 'seasonal-line':{stroke:'#9ab9c5',width:.4}, stream:{stroke:'#70a0b5',width:.48},
 river:{stroke:'#518fab',width:.72}, main:{stroke:'#3a82a2',width:1.05}
};
const thresholds=[3,5.7,9.25,11.8];
const spans=[null,[8,30],[8,8],[2,2],[2,2]];

export function freshwaterLevel(camera,plot){
 const z=camera.zoom-Math.log2(Math.max(1,plot.w)/990)*.35;
 return thresholds.filter(value=>z>=value).length;
}
export function freshwaterBounds(settings,camera,plot){
 if(!projected(settings,camera,plot))return mercatorBounds(camera,plot);
 if(camera.zoom<3)return [-180,-85,180,85];
 const point=projector(settings,camera,plot),center=unproject(camera.x,camera.y)[0],xs=[],ys=[];
 for(let x=0;x<=16;x++)for(let y=0;y<=12;y++){
  const coord=point.invert(plot.x+plot.w*x/16,plot.y+plot.h*y/12);
  if(!coord||!coord.every(Number.isFinite))continue;
  const [lon,lat]=coord;
  xs.push(lon+360*Math.round((center-lon)/360));ys.push(lat);
 }
 if(!xs.length)return [-180,-85,180,85];
 const margin=Math.min(8,2**(7-camera.zoom));
 return [Math.min(...xs)-margin,Math.max(-85,Math.min(...ys)-margin),Math.max(...xs)+margin,Math.min(85,Math.max(...ys)+margin)];
}
export function tileKeys(bounds,level){
 const [dx,dy]=spans[level],cols=360/dx,[w,s,e,n]=bounds;
 const left=Math.floor((w+180)/dx),right=Math.min(left+cols-1,Math.floor((e+180)/dx));
 const first=Math.floor((Math.max(-85,s)+90)/dy),last=Math.floor((Math.min(85,n)+90)/dy);
 const keys=[];
 for(let x=left;x<=right;x++)for(let y=first;y<=last;y++)keys.push(`${level}/${modulo(x,cols)}_${y}`);
 return keys;
}

// SPW1 stores the TopoJSON header and packs signed arc deltas as variable-length integers.
function unpackFreshwaterTile(bytes){
 if(bytes.length<8||new TextDecoder().decode(bytes.subarray(0,4))!=='SPW1')throw Error('Invalid freshwater tile header');
 const headerEnd=8+new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(4,true);
 if(headerEnd>=bytes.length)throw Error('Invalid freshwater tile length');
 const topology=JSON.parse(new TextDecoder().decode(bytes.subarray(8,headerEnd)));
 let offset=headerEnd;
 function integer(){
  let result=0;
  for(let shift=0;shift<=28&&offset<bytes.length;shift+=7){
   const byte=bytes[offset++];
   result+=(byte&127)*2**shift;
   if(byte<128)return result;
  }
  throw Error('Invalid freshwater tile integer');
 }
 function signed(){
  const value=integer();
  return value%2?-(value+1)/2:value/2;
 }
 const count=integer(),arcs=[];
 if(count>bytes.length-offset)throw Error('Invalid freshwater arc count');
 for(let index=0;index<count;index++){
  const scale=integer(),points=integer(),arc=[];
  if(![1,2,4].includes(scale)||points<2||points>(bytes.length-offset)/2)throw Error('Invalid freshwater arc');
  for(let point=0;point<points;point++)arc.push([signed()*scale,signed()*scale]);
  arcs.push(arc);
 }
 if(offset!==bytes.length)throw Error('Unexpected freshwater tile content');
 return {...topology,arcs};
}

// The prepared tiles store WGS84 arcs as delta-encoded integers.
export function readFreshwaterTile(data){
 if(data instanceof Uint8Array)data=unpackFreshwaterTile(data);
 if(data.type!=='Topology')return data;
 const collection=data.objects?.freshwater,transform=data.transform;
 if(collection?.type!=='GeometryCollection'||!Array.isArray(data.arcs)||!Array.isArray(transform?.scale)||!Array.isArray(transform.translate))throw Error('Invalid freshwater topology');
 const [sx,sy]=transform.scale,[tx,ty]=transform.translate;
 return {type:'FeatureCollection',features:collection.geometries.map(shape=>{
  const bbox=[Infinity,Infinity,-Infinity,-Infinity];
  function path(indices){
   const coords=[];
   for(const id of indices){
    let a=0,b=0;
    const part=data.arcs[id<0?~id:id].map(([dx,dy])=>{
     a+=dx;b+=dy;
     const x=a*sx+tx,y=b*sy+ty;
     bbox[0]=Math.min(bbox[0],x);bbox[1]=Math.min(bbox[1],y);
     bbox[2]=Math.max(bbox[2],x);bbox[3]=Math.max(bbox[3],y);
     return [x,y];
    });
    if(id<0)part.reverse();
    for(let i=coords.length?1:0;i<part.length;i++)coords.push(part[i]);
   }
   return coords;
  }
  const type=shape.type;
  let coordinates;
  switch(type){
   case 'LineString':coordinates=path(shape.arcs);break;
   case 'MultiLineString':
   case 'Polygon':coordinates=shape.arcs.map(path);break;
   case 'MultiPolygon':coordinates=shape.arcs.map(poly=>poly.map(path));break;
   default:throw Error('Unknown freshwater geometry');
  }
  return {type:'Feature',bbox,geometry:{type,coordinates},properties:shape.properties};
 })};
}

export class FreshwaterLayers extends DetailLayers{
 constructor(onChange){super('freshwater',onChange,'index.json.gz');}
 prepare(data){return readFreshwaterTile(data);}
 selection(bounds,requested){
  if(!this.index)return {level:requested,files:[]};
  for(let level=requested;level>0;level--){
   const keys=tileKeys(bounds,level);
   if(level===4&&keys.some(key=>this.index.previewOmitted?.[key]))continue;
   if(keys.length<=24)return {level,files:keys.map(key=>this.index.tiles[key]?.file).filter(Boolean)};
  }
  return {level:0,files:[this.index.overview]};
 }
 plan(camera,bounds,level){return this.selection(bounds,level).files;}
 viewport(settings,camera,plot){
  const key=[settings.projection,settings.mapScope,settings.worldCenter,camera.x,camera.y,camera.zoom,plot.x,plot.y,plot.w,plot.h].join('/');
  if(key!==this.viewKey){this.bounds=freshwaterBounds(settings,camera,plot);this.viewKey=key;}
  return [camera,this.bounds,freshwaterLevel(camera,plot)];
 }
 layerStatus(active,settings,camera,plot,request=true){
  return active?super.status(true,...this.viewport(settings,camera,plot),{request}):super.status(false);
 }
 visible(settings,camera,plot){
  const view=this.viewport(settings,camera,plot),data=super.data(...view);
  if(!data)return null;
  const [,bounds,level]=view;
  return {source:this.index.source,...this.selection(bounds,level),bounds,features:data.features.filter(f=>geographicOverlap(f.bbox,bounds,true))};
 }
}
