import {boundsOf,geographicOverlap} from './longitude.mjs';
// Optional bundled layer: load once on demand and keep it for pan/export.
export class Admin1Layer{
 constructor(onChange){this.onChange=onChange;this.state='idle';this.data=null;this.promise=null;}
 load(){
  if(this.state!=='idle')return this.promise;
  this.state='loading';
  this.promise=(async()=>{
   try{
    const response=await fetch('./assets/world-admin1.json');
    if(!response.ok)throw Error('Admin-1 HTTP '+response.status);
    const data=await response.json();
    if(data.type!=='FeatureCollection'||!Array.isArray(data.features)||!Array.isArray(data.labels))throw Error('Invalid admin-1 data');
    this.data=data;this.state='ready';
   }catch{this.state='error';}
   finally{this.onChange();}
  })();
  return this.promise;
 }
 retry(){if(this.state==='error'){this.state='idle';return this.load();}}
}
export const overlaps=geographicOverlap;
export function admin1Path(geometry,point){
 if(point.path)return point.path(geometry)||'';
 const lines=geometry.type==='LineString'?[geometry.coordinates]:geometry.coordinates;
 if(point.copies)return lines.map(line=>point.copies(boundsOf(line)).map(q=>admin1Path({type:'LineString',coordinates:line},q)).join('')).join('');
 return lines.map(line=>line.map((ll,i)=>{const p=point(...ll);return (i?'L':'M')+p[0].toFixed(2)+','+p[1].toFixed(2);}).join('')).join('');
}
export function visibleAdmin1(data,bounds){return data.features.filter(f=>overlaps(f.bbox,bounds));}
