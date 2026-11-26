import {rampColor} from './core.mjs';
import {overlaps} from './admin1.mjs';
export const DEPTH_BANDS=[
 [0,'#e6f4f7'],[200,'#cce9f0'],[1000,'#a9d9e8'],[2000,'#80c2dc'],
 [3000,'#57a5cc'],[4000,'#3886b7'],[5000,'#28679c'],[6000,'#235187'],
 [7000,'#233e70'],[8000,'#202f59'],[9000,'#1b2345'],[10000,'#141931']
];
export const OCEAN_MAX_DEPTH=11000;
export const OCEAN_STOPS=[...DEPTH_BANDS,[OCEAN_MAX_DEPTH,'#0a1023']];
export const OCEAN_ELEVATION_RAMP=OCEAN_STOPS.map(([depth,color])=>[-depth,color]).reverse();
export const WATER_SOURCE='Water: continuous ocean bathymetry from Mapzen/AWS Terrain Tiles (ETOPO1, DOC/NOAA/NESDIS/NCEI), accessed 2026-10-21; pixel elevations mapped through an interpolated 0–11000 m blue palette. Tile zoom and image interpolation do not add measurement accuracy. Ocean mask follows the active land/coastline geometry. Optional generalized contours: Natural Earth bathymetry 4.1.0 (SRTM Plus), public domain, original scale 1:10,000,000. Not for navigation. https://github.com/tilezen/joerd/blob/master/docs/data-sources.md';
export const needsOcean=s=>!!(s.ocean||s.bathymetry||s.isobaths);
export function waterKeys(s){return s.isobaths?['bathymetry']:[];}
export function depthColor(depth){return '#'+rampColor(Math.max(0,depth),OCEAN_STOPS).map(v=>v.toString(16).padStart(2,'0')).join('');}
export function visibleWater(data,bounds){return data?.features.filter(f=>overlaps(f.bbox,bounds))||[];}
export class WaterLayers{
 constructor(onChange){this.onChange=onChange;this.layers=new Map();}
 load(key){
  const old=this.layers.get(key);if(old)return old.promise;
  const layer={state:'loading',data:null,promise:null};this.layers.set(key,layer);
  layer.promise=(async()=>{try{
   const response=await fetch(`./assets/water-${key}.json`);if(!response.ok)throw Error('Water HTTP '+response.status);
   const data=await response.json();if(data.type!=='FeatureCollection'||!Array.isArray(data.features)||!data.features.length||data.features.some(f=>!Array.isArray(f.bbox)||f.bbox.length!==4||!f.bbox.every(Number.isFinite)))throw Error('Invalid water data');
   layer.data=data;layer.state='ready';
  }catch{layer.state='error';}finally{this.onChange();}})();return layer.promise;
 }
 data(key){return this.layers.get(key)?.data;}
 status(settings){const keys=waterKeys(settings);keys.forEach(k=>this.load(k));return {ready:keys.every(k=>this.layers.get(k).state==='ready'),pending:keys.some(k=>this.layers.get(k).state==='loading'),failed:keys.some(k=>this.layers.get(k).state==='error'),count:keys.length};}
 retry(settings){
  for(const key of waterKeys(settings)){
   if(this.layers.get(key)?.state!=='error')continue;
   this.layers.delete(key);
   this.load(key);
  }
 }
}
