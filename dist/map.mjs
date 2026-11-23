import {countryLabels} from './country-labels.mjs';
import {placeName} from './place-names.mjs';
import {LandContours,contourLabels} from './contours.mjs';
import {wrapLongitude,nearUnit,modulo,mercatorDomain,mercatorBounds,longitudeCopies,boundsOf,tilePlacements} from './longitude.mjs';
import {DetailLayers} from './detail-layers.mjs';
import {effectiveMapSettings,streetBasemap,attributionHeight} from './basemap-settings.mjs';
import {StreetMap,OSM_SOURCE,OSM_ATTRIBUTION,OSM_COPYRIGHT} from './street-map.mjs';
import {pathVertices,recipeColor} from './map-recipe.mjs';
import {markerShape,markerPath} from './markers.mjs';
import {WaterLayers,needsOcean,visibleWater,DEPTH_BANDS,OCEAN_STOPS,OCEAN_MAX_DEPTH,OCEAN_ELEVATION_RAMP,LAKE_STYLE,WATER_SOURCE} from './water.mjs';
import {Admin1Layer,visibleAdmin1,admin1Path,overlaps} from './admin1.mjs';
import {getLanguage,tx} from './i18n.mjs';
import {pageSize,outputSize} from './page.mjs';
import {legendOptions,legendSidebar,legendBlocks,LEGEND_FONTS} from './legend.mjs';
import {labelFace,labelFont,embeddedLabelFont} from './label-fonts.mjs';
import {taxonLabelRuns} from './taxon-typography.mjs';
import {worldMode,elevationScale,outlineGeometry,polarGaps} from './world.mjs';
import {projected,projector,fitProjection,projectionSource,geoGraticule,geoCircle,geoDistance} from './projection.mjs';
import {ProjectedRaster} from './projected-raster.mjs';
import {EcologyLayers,biomeColor,ECOLOGY_SOURCE} from './ecology.mjs';
import {RAMP,project,unproject,decodeTerrarium,rampColor,escapeXML} from './core.mjs';
export const SIZE={width:1200,height:960};
const SOURCE='Country labels exclude Natural Earth 1:10m breakaway/disputed polygons v5.1.1 (except Lease/Overlay types); source coverage is version-dependent. Taiwan Atlas 2021.9.20 / MOI NLSC; World: Natural Earth Admin 0 Countries 5.1.1 (1:50 million); optional Admin 1 boundary lines 5.1.0 and labels 5.1.1 (1:10 million, Public Domain), accessed 2026-10-20; Terrain Tiles: Mapzen, USGS SRTM & GMTED2010, DOC/NOAA/NESDIS/NCEI. Accessed 2026-10-19. EPSG:3857. Basemap coverage: 85 S to 85 N; hatched polar areas lie outside coverage. Dataset cut edges are not coastlines. Hypsometric tint and hillshade modified in browser. '+WATER_SOURCE;
export function mapSource(state){if(streetBasemap(state.settings))return OSM_SOURCE+' '+projectionSource(state.settings,state.camera,layout(state.settings));return (state.settings.coastDetail?'Coastline and land mask: © OpenStreetMap contributors, ODbL, https://www.openstreetmap.org/copyright; processed and simplified, see assets/coast-detail/index.json. ':'')+(state.settings.waterDetail?'Detailed inland waters: RiverATLAS v1 (Linke et al. 2019, doi:10.1038/s41597-019-0300-6) and HydroLAKES v1 (Messager et al. 2016, doi:10.1038/ncomms13603), CC BY 4.0; cartographic subset, see assets/hydro-detail/index.json. ':'')+(state.settings.landContours?' Land contours derived from Terrain Tiles DEM; interval '+(state.settings.contourInterval||500)+' m. ':'')+SOURCE.replace(' EPSG:3857.',' ')+projectionSource(state.settings,state.camera,layout(state.settings))+(state.settings.ecologyTheme==='biomes'||state.settings.ecoregions?' '+ECOLOGY_SOURCE:'');}
export function layout(settings){settings=effectiveMapSettings(settings);const f=pageSize(settings),side=legendSidebar(settings);return {x:65+(legendOptions(settings).position==='left'?side:0),y:35,w:f.width-105-side,h:f.height-100-attributionHeight(settings)};}
export function position(lon,lat,camera,p,settings={}){if(projected(settings,camera,p))return projector(settings,camera,p)(lon,lat);const q=project(lon,lat),s=256*2**camera.zoom;return [p.x+p.w/2+(nearUnit(q[0],camera.x)-camera.x)*s,p.y+p.h/2+(q[1]-camera.y)*s];}
export function inversePosition(x,y,camera,p,settings={}){if(projected(settings,camera,p))return projector(settings,camera,p).invert(x,y)||[NaN,NaN];const s=256*2**camera.zoom;const q=unproject(camera.x+(x-p.x-p.w/2)/s,camera.y+(y-p.y-p.h/2)/s);return [wrapLongitude(q[0]),q[1]];}
export function mercatorPoint(camera,p){
 const point=(lon,lat)=>position(lon,lat,camera,p),scale=256*2**camera.zoom;point.bounds=mercatorBounds(camera,p);
 point.copies=b=>{if(b[1]>point.bounds[3]||b[3]<point.bounds[1])return [];return longitudeCopies(b[0],b[2],point.bounds[0],point.bounds[2]).map(offset=>{const q=(lon,lat)=>{const xy=project(lon+offset,lat);return [p.x+p.w/2+(xy[0]-camera.x)*scale,p.y+p.h/2+(xy[1]-camera.y)*scale];};q.bounds=[point.bounds[0]-offset,point.bounds[1],point.bounds[2]-offset,point.bounds[3]];return q;});};return point;
}
export const TERRAIN_QUALITIES=['fast','auto','detail','maximum'];
export function terrainPlan(settings,camera){
 if(settings.terrainQuality===undefined&&Number.isInteger(settings.terrainZoom))return {quality:'legacy',zoom:Math.max(7,Math.min(12,settings.terrainZoom)),limit:120};
 const quality=TERRAIN_QUALITIES.includes(settings.terrainQuality)?settings.terrainQuality:'auto';
 const minimum=settings.mapScope==='world'||camera.zoom<6?0:8;
 const base=Math.max(minimum,Math.min(12,Math.floor(camera.zoom+.25)));
 const profile={fast:{offset:-1,limit:48},auto:{offset:0,limit:120},detail:{offset:1,limit:220},maximum:{offset:2,limit:420}}[quality];
 return {quality,zoom:Math.max(minimum===0?0:7,Math.min(12,base+profile.offset)),limit:profile.limit};
}
export function oceanPlan(settings,camera){const p=terrainPlan({...settings,terrainQuality:settings.terrainQuality||'auto',mapScope:'world'},camera);return {...p,zoom:Math.max(1,Math.min(8,p.zoom))};}
// Bound the land mask before Canvas clipping. Far-away world vertices can
// overflow a rasterizer's clip representation at local map/export scales.
function clipRing(points,box){
 const edges=[[0,box.x,false],[0,box.x+box.w,true],[1,box.y,false],[1,box.y+box.h,true]];
 for(const [axis,edge,less] of edges){
  if(!points.length)break;
  const result=[],inside=p=>less?p[axis]<=edge:p[axis]>=edge;
  let previous=points.at(-1),wasInside=inside(previous);
  for(const current of points){
   const isInside=inside(current);
   if(isInside!==wasInside){const t=(edge-previous[axis])/(current[axis]-previous[axis]);result.push([previous[0]+t*(current[0]-previous[0]),previous[1]+t*(current[1]-previous[1])]);}
   if(isInside)result.push(current);
   previous=current;wasInside=isInside;
  }
  points=result;
 }
 return points;
}
function pathGeometry(geometry,point,clipTo){
 if(point.path)return point.path(geometry)||'';
 const parts=[],polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
 if(point.copies)return polygons.map(polygon=>point.copies(boundsOf(polygon[0])).map(q=>pathGeometry({type:'Polygon',coordinates:polygon},q,clipTo)).join('')).join('');
 for(const polygon of polygons){
  if(point.bounds){let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;for(const [x,y] of polygon[0]){west=Math.min(west,x);east=Math.max(east,x);south=Math.min(south,y);north=Math.max(north,y);}const b=point.bounds;if(east<b[0]||west>b[2]||north<b[1]||south>b[3])continue;}
  for(const ring of polygon){
   const projected=ring.map(p=>point(...p)),vertices=clipTo?clipRing(projected,clipTo):projected;
   if(vertices.length<3)continue;
   parts.push(vertices.map((a,i)=>(i?'L':'M')+a[0].toFixed(2)+','+a[1].toFixed(2)).join('')+'Z');
  }
 }
 return parts.join('');
}
export function interiorBoundaries(features){
 const segments=new Map(),key=p=>p.map(n=>n.toFixed(5)).join(',');
 for(const f of features){const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;for(const polygon of polygons)for(const ring of polygon)for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],ka=key(a),kb=key(b),id=ka<kb?ka+'|'+kb:kb+'|'+ka;const prior=segments.get(id);if(prior)prior.count++;else segments.set(id,{count:1,line:[a,b]});}}
 return {type:'MultiLineString',coordinates:[...segments.values()].filter(s=>s.count>1).map(s=>s.line)};
}
function labelPoint(g){const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;let best=null,areaMax=-1;for(const poly of polygons){const ring=poly[0];let area=0,cx=0,cy=0;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[j],b=ring[i],z=a[0]*b[1]-b[0]*a[1];area+=z;cx+=(a[0]+b[0])*z;cy+=(a[1]+b[1])*z;}if(Math.abs(area)>areaMax&&area!==0){areaMax=Math.abs(area);best=[cx/(3*area),cy/(3*area)];}}return best||polygons[0][0][0];}
function legendLines(ctx,text,width,size,font){
 const tokens=/[\u3040-\u30ff\u3400-\u9fff]/.test(text)?Array.from(text):text.split(/(\s+)/);let lines=[];
 for(let attempt=0;attempt<24;attempt++){ctx.font=`${size}px ${font}`;lines=[];let current='';for(const token of tokens){if(ctx.measureText(current+token).width>width&&current.trim()){lines.push(current.trim());current='';}current+=token;}if(current.trim())lines.push(current.trim());if(lines.length<=2||size<=6)break;size*=.92;}
 return {lines,size};
}
class Painter{
 constructor(ctx,svg=false){this.ctx=ctx;this.parts=svg?[]:null;this.faces=svg?new Set():null;this.commands=null;this.recordMeta={};}
 record(type,values){if(this.commands)this.commands.push({type,...this.recordMeta,...values});}
 unrecorded(fn){const records=this.commands;this.commands=null;try{fn();}finally{this.commands=records;}}
 path(d,{fill='none',stroke='none',width=1,opacity=1}={}){if(this.commands)this.record('path',{paths:pathVertices(d),fill:recipeColor(fill),stroke:recipeColor(stroke),width,opacity});const c=this.ctx;c.save();c.globalAlpha=opacity;const p=new Path2D(d);if(fill!=='none'){c.fillStyle=fill;c.fill(p,'evenodd');}if(stroke!=='none'){c.strokeStyle=stroke;c.lineWidth=width;c.lineJoin='round';c.stroke(p);}c.restore();this.parts?.push(`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" opacity="${opacity}" fill-rule="evenodd"/>`);}
 line(x1,y1,x2,y2,color='#3a483a',width=1,opacity=1){this.path(`M${x1},${y1}L${x2},${y2}`,{stroke:color,width,opacity});}
 rect(x,y,w,h,fill,stroke='none',width=1){this.record('rect',{x,y,w,h,fill:recipeColor(fill),stroke:recipeColor(stroke),width});this.ctx.fillStyle=fill;if(fill!=='none')this.ctx.fillRect(x,y,w,h);if(stroke!=='none'){this.ctx.strokeStyle=stroke;this.ctx.lineWidth=width;this.ctx.strokeRect(x,y,w,h);}this.parts?.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`);}
 text(text,x,y,{size=12,color='#374439',italic=false,font='Arial',align='left',weight='normal',halo=0,emitSvg=true}={}){
  this.record('text',{text,x,y,size,color:recipeColor(color),italic,font,align,weight});
  const family=labelFont(text,font,italic,weight),face=labelFace(text,font,italic,weight);
  if(face)this.faces?.add(face);
  const c=this.ctx;
  c.font=`${italic?'italic ':''}${weight} ${size}px ${family}`;
  c.fillStyle=color;c.textAlign=align;
  if(halo){c.save();c.strokeStyle='#ffffff';c.lineWidth=halo;c.lineJoin='round';c.strokeText(text,x,y);c.restore();}
  c.fillText(text,x,y);
  if(emitSvg)this.parts?.push(`<text ${halo?`stroke="#ffffff" stroke-width="${halo}" stroke-linejoin="round" paint-order="stroke fill" `:''}x="${x}" y="${y}" fill="${color}" font-size="${size}" font-family="${escapeXML(family)}" font-style="${italic?'italic':'normal'}" font-weight="${weight}" text-anchor="${align==='center'?'middle':align==='right'?'end':'start'}">${escapeXML(text)}</text>`);
 }
 legendName(runs,x,y,maxWidth,style){
  const {font,weight,color}=style;
  const parts=runs.map(run=>({...run,italic:run.italic??style.italic}));
  const width=parts.reduce((sum,{text,italic})=>{
   this.ctx.font=`${italic?'italic ':''}${weight} ${style.size}px ${labelFont(text,font,italic,weight)}`;
   return sum+this.ctx.measureText(text).width;
  },0);
  const size=Math.min(style.size,style.size*maxWidth/Math.max(1,width));
  if(parts.length===1){
   this.text(parts[0].text,x,y,{...style,size,italic:parts[0].italic});
   return;
  }
  let cursor=x;
  const spans=[];
  for(const {text,italic} of parts){
   this.text(text,cursor,y,{...style,size,italic,emitSvg:false});
   if(this.parts)spans.push(`<tspan x="${cursor}" font-family="${escapeXML(labelFont(text,font,italic,weight))}" font-style="${italic?'italic':'normal'}">${escapeXML(text)}</tspan>`);
   cursor+=this.ctx.measureText(text).width;
  }
  this.parts?.push(`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-weight="${weight}" xml:space="preserve">${spans.join('')}</text>`);
 }
 fontStyles(){return this.faces?.size?'<style>'+Array.from(this.faces,embeddedLabelFont).join('')+'</style>':'';}
 circle(x,y,r,fill,stroke='#26372b',width=.9){this.record('circle',{x,y,r,fill:recipeColor(fill),stroke:recipeColor(stroke),width});this.ctx.beginPath();this.ctx.arc(x,y,r,0,Math.PI*2);if(fill!=='none'){this.ctx.fillStyle=fill;this.ctx.fill();}if(stroke!=='none'&&width>0){this.ctx.strokeStyle=stroke;this.ctx.lineWidth=width;this.ctx.stroke();}this.parts?.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`);}
 marker(x,y,r,shape,fill,stroke='#26372b',width=.9){
  this.parts?.push(`<g data-marker-shape="${shape}">`);
  this.record('marker',{x,y,r,shape,fill:recipeColor(fill),stroke:recipeColor(stroke),width});
  this.unrecorded(()=>{if(shape==='circle')this.circle(x,y,r,fill,stroke,width);else this.path(markerPath(shape,x,y,r),{fill,stroke,width});});
  this.parts?.push('</g>');
 }
 wedge(x,y,r,start,end,fill){const x1=x+r*Math.cos(start),y1=y+r*Math.sin(start),x2=x+r*Math.cos(end),y2=y+r*Math.sin(end);this.path(`M${x},${y}L${x1},${y1}A${r},${r} 0 ${end-start>Math.PI?1:0} 1 ${x2},${y2}Z`,{fill,stroke:'#fff',width:.45});}
}
function drawMapAttribution(paint,figure,s){
 const height=attributionHeight(s);if(!height)return;
 paint.recordMeta={layer:'attribution',clip:false};paint.rect(0,figure.height-height,figure.width,height,'#ffffff');
 let y=figure.height-height+19;
 if(streetBasemap(s)||s.coastDetail){paint.parts?.push(`<a href="${OSM_COPYRIGHT}">`);paint.text(OSM_ATTRIBUTION,figure.width-16,y,{size:12,color:'#374439',align:'right'});paint.parts?.push('</a>');y+=22;}
 if(!streetBasemap(s)&&s.waterDetail&&(s.rivers||s.lakes)){paint.text('RiverATLAS (Linke et al., 2019) / HydroLAKES (Messager et al., 2016) · CC BY 4.0',figure.width-16,y,{size:11,color:'#374439',align:'right'});}
}
export class Terrain{
 constructor(onChange){this.tiles=new Map();this.queue=[];this.running=0;this.onChange=onChange;this.local=new Set();this.ready=fetch('./assets/terrain-index.json').then(r=>r.json()).then(x=>this.local=new Set(x));}
 request(key){if(this.tiles.has(key))return this.tiles.get(key);const tile={status:'pending',key};this.tiles.set(key,tile);this.queue.push(tile);this.pump();return tile;}
 pump(){while(this.running<6&&this.queue.length){const tile=this.queue.shift();this.running++;this.load(tile).finally(()=>{this.running--;this.onChange();this.pump();});}}
 async load(tile){try{await this.ready;const [z,x,y]=tile.key.split('/').map(Number);let img=new Image();img.crossOrigin='anonymous';await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{img.src='';reject(Error('DEM 讀取逾時'));},20000);img.onload=()=>{clearTimeout(timeout);resolve();};img.onerror=()=>{clearTimeout(timeout);reject(Error('DEM 圖磚載入失敗'));};img.src=this.local.has(tile.key)?`./assets/terrain/${tile.key}.png`:`https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${tile.key}.png`;});const cv=document.createElement('canvas');cv.width=cv.height=256;const c=cv.getContext('2d',{willReadFrequently:true});c.drawImage(img,0,0);const pixels=c.getImageData(0,0,256,256).data;const elev=new Float32Array(65536);for(let i=0;i<elev.length;i++)elev[i]=decodeTerrarium(...pixels.subarray(i*4,i*4+3));tile.elev=elev;tile.z=z;tile.x=x;tile.y=y;tile.status='ready';}catch(e){tile.status='error';tile.error=e.message;}}
 retry(){for(const [k,t] of this.tiles)if(t.status==='error')this.tiles.delete(k);this.onChange();}
 visible(camera,p,zoom,limit=120){let z=zoom,placements,keys;do{placements=tilePlacements(camera,p,z,limit);if(placements){keys=[...new Set(placements.map(t=>t.key))];break;}z--;}while(z>=0);return {z,tiles:keys.map(k=>this.request(k)),placements};}
 color(tile,settings,ramp=RAMP){
  const neighbors=[];
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const t=dx===0&&dy===0?tile:this.tiles.get(`${tile.z}/${modulo(tile.x+dx,2**tile.z)}/${tile.y+dy}`);neighbors.push(t?.status==='ready'?t:null);}
  const key=[settings.hillshade,settings.shadow,settings.direction,settings.angle].join('/');
  const cached=tile.colors?.get(ramp);
  if(cached?.key===key&&cached.neighbors.every((t,i)=>t===neighbors[i]))return cached.canvas;
  // Two DEM pixels support centered slopes plus a one-pixel texture gutter.
  const stride=260,e=new Float32Array(stride*stride);
  for(let y=-2;y<258;y++)for(let x=-2;x<258;x++){
   const dx=Math.floor(x/256),dy=Math.floor(y/256),t=neighbors[(dy+1)*3+dx+1];
   e[(y+2)*stride+x+2]=t?t.elev[(y-dy*256)*256+x-dx*256]:tile.elev[Math.max(0,Math.min(255,y))*256+Math.max(0,Math.min(255,x))];
  }
  const canvas=cached?.canvas||document.createElement('canvas');canvas.width=canvas.height=258;
  const c=canvas.getContext('2d'),image=c.createImageData(258,258),d=image.data;
  const az=settings.direction*Math.PI/180,alt=settings.angle*Math.PI/180,lx=Math.sin(az)*Math.cos(alt),ly=Math.cos(az)*Math.cos(alt),lz=Math.sin(alt);
  for(let y=-1;y<=256;y++){
   // Use the pixel latitude so overlapping gutters have identical shading.
   const lat=unproject(0,(tile.y*256+y+.5)/(256*2**tile.z))[1],meters=40075016.686*Math.cos(lat*Math.PI/180)/(256*2**tile.z);
   for(let x=-1;x<=256;x++){
    const i=(y+2)*stride+x+2,out=((y+1)*258+x+1)*4,col=rampColor(e[i],ramp);let light=1;
    if(settings.hillshade){const dx=(e[i+1]-e[i-1])/(2*meters),dy=(e[i-stride]-e[i+stride])/(2*meters),illum=Math.max(0,(-dx*lx-dy*ly+lz)/Math.hypot(dx,dy,1));light=1-settings.shadow*(1-illum);}
    for(let k=0;k<3;k++)d[out+k]=col[k]*light;d[out+3]=255;
   }
  }
  c.putImageData(image,0,0);tile.colorKey=key;tile.colorRamp=ramp;tile.colorNeighbors=neighbors;tile.canvas=canvas;tile.colors??=new Map();tile.colors.delete(ramp);tile.colors.set(ramp,{key,neighbors,canvas});if(tile.colors.size>2)tile.colors.delete(tile.colors.keys().next().value);return canvas;
 }
}
export class MapRenderer{
 constructor(canvas,onUpdate){this.canvas=canvas;this.landContours=new LandContours();this.coastDetail=new DetailLayers('coast-detail',onUpdate);this.hydroDetail=new DetailLayers('hydro-detail',onUpdate);this.street=new StreetMap(onUpdate);this.terrain=new Terrain(onUpdate);this.projectedRaster=new ProjectedRaster(this.terrain);this.admin1=new Admin1Layer(onUpdate);this.water=new WaterLayers(onUpdate);this.ecology=new EcologyLayers(onUpdate);this.geometry=null;this.hitMarkers=[];}
 async init(){const responses=await Promise.all([fetch('./assets/boundaries.json'),fetch('./assets/world-countries.geojson')]);if(responses.some(r=>!r.ok))throw Error('行政界線無法載入。');this.geometry=await responses[0].json();this.world=await responses[1].json();this.interior={countries:interiorBoundaries(this.world.features),counties:interiorBoundaries(this.geometry.counties.features),towns:interiorBoundaries(this.geometry.towns.features)};for(const k of ['counties','towns'])for(const f of this.geometry[k].features)f.labelPoint=labelPoint(f.geometry);}
 status(state){
  const s=effectiveMapSettings(state.settings),p=layout(s);if(streetBasemap(s)){this.coastDetail.status(false);this.hydroDetail.status(false);const v=this.street.view(state.camera,p,{request:!state.interacting});return {...v,street:true,streetFailed:!!v.failed,streetPending:!v.ready&&!v.failed,message:v.failed?'OpenStreetMap 街道底圖載入失敗，請重新載入或切回地形底圖。':tx('osmStatus',{loaded:v.loaded,total:v.tiles.length,zoom:v.z},state.language||getLanguage())};}this.street.pause();let terrain={ready:true,message:s.ecologyTheme==='biomes'?'生物群系底色啟用中；海拔配色設定會保留。':'彩色海拔已關閉 · 行政區底圖',tiles:[],failed:0};
  if(s.terrain||s.landContours){const plan=terrainPlan(s,state.camera),v=this.visibleTiles({...state,settings:s},p,plan),loaded=v.tiles.filter(t=>t.status==='ready').length,failed=v.tiles.filter(t=>t.status==='error').length;terrain={...v,ready:loaded===v.tiles.length,failed,message:`海拔 ${loaded}/${v.tiles.length} · DEM z${v.z}${v.z!==plan.zoom?'（依範圍調整）':''}${failed?` · ${failed} 張載入失敗`:''}`};}
  const curved=projected(s,state.camera,p),bounds=curved?null:mercatorBounds(state.camera,p);
  const details=[this.coastDetail.status(s.coastDetail,state.camera,bounds,curved),this.hydroDetail.status(s.waterDetail&&(s.rivers||s.lakes),state.camera,bounds,curved)];
  terrain={...terrain,ready:terrain.ready&&details.every(d=>d.ready),failed:terrain.failed+details.filter(d=>d.failed).length,detailFailed:details.some(d=>d.failed),detailPending:details.some(d=>d.pending)};
  const water=this.water.status(s);let depthReady=true,depthFailed=0;
  if(s.bathymetry){const plan=oceanPlan(s,state.camera),v=this.visibleTiles({...state,settings:s},p,plan);depthReady=v.tiles.every(t=>t.status==='ready');depthFailed=v.tiles.filter(t=>t.status==='error').length;}
  const waterFailed=water.failed||depthFailed>0,waterPending=water.pending||!depthReady&&!depthFailed;
  terrain={...terrain,ready:terrain.ready&&water.ready&&depthReady,failed:terrain.failed+Number(water.failed)+depthFailed,waterFailed,waterPending,waterMessage:water.count||s.bathymetry?tx(waterFailed?'waterFailed':waterPending?'waterLoading':'waterReady',{},state.language||getLanguage()):''};
  const eco=this.ecology.status(s);terrain={...terrain,ready:terrain.ready&&eco.ready,failed:terrain.failed+Number(eco.failed),ecologyFailed:eco.failed,ecologyPending:!eco.ready&&!eco.failed,ecologyMessage:eco.active?tx(eco.failed?'ecologyFailed':eco.ready?'ecologyReady':'ecologyLoading',{},state.language||getLanguage()):''};
  if(!worldMode(s,state.camera,p)||!s.provinces&&!s.provinceLabels)return terrain;
  this.admin1.load();const adminReady=this.admin1.state==='ready',adminFailed=this.admin1.state==='error';
  return {...terrain,ready:terrain.ready&&adminReady,failed:terrain.failed+Number(adminFailed),adminFailed,adminPending:!adminReady&&!adminFailed,adminMessage:tx(adminReady?'admin1Ready':adminFailed?'admin1Failed':'admin1Loading',{},state.language||getLanguage())};
 }
 render(state,{canvas=this.canvas,width=1200,svg=false,rBundle=false}={}){
  state={...state,settings:effectiveMapSettings(state.settings)};
  const figure=pageSize(state.settings),output=outputSize(state.settings,width);canvas.width=output.width;canvas.height=output.height;const ctx=canvas.getContext('2d'),scale=width/figure.width;ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.fillRect(0,0,figure.width,figure.height);if(!this.geometry)return {canvas};
  const s=state.settings,p=layout(s),camera=state.camera,curved=projected(s,camera,p),point=curved?projector(s,camera,p):mercatorPoint(camera,p),domain=curved?p:mercatorDomain(camera,p),globalMap=worldMode(s,camera,p);const coastData=s.coastDetail?this.coastDetail.data(camera,point.bounds,curved):null;const landFeatures=coastData?coastData.features.filter(f=>f.properties.kind==='land'):globalMap?(this.world?.land?.features||[]):this.geometry.nation.features;const land=coastData?coastData.features.filter(f=>f.properties.kind==='coast').map(f=>admin1Path(f.geometry,point)).join(''):landFeatures.map(f=>globalMap?outlineGeometry(f.geometry,point):pathGeometry(f.geometry,point)).join('');
  if((canvas!==this.canvas||svg||rBundle)&&(s.coastDetail&&!coastData||s.waterDetail&&(s.rivers||s.lakes)&&!this.hydroDetail.data(camera,point.bounds,curved)))throw Error('詳細地理圖層尚未載入完成。');
  if(curved&&canvas!==this.canvas)for(const plan of [...(s.terrain?[terrainPlan(s,camera)]:[]),...(s.bathymetry?[oceanPlan(s,camera)]:[])])if(this.visibleTiles(state,p,plan,scale).tiles.some(t=>t.status!=='ready'))throw Error('目前範圍的海拔仍在載入，完成後即可匯出。');
  if(s.landContours&&(canvas!==this.canvas||svg||rBundle)&&this.visibleTiles(state,p,terrainPlan(s,camera)).tiles.some(t=>t.status!=='ready'))throw Error('目前範圍的海拔仍在載入，完成後即可匯出。');
  const landPath=streetBasemap(s)?'':landFeatures.map(f=>pathGeometry(f.geometry,point,{x:p.x-1,y:p.y-1,w:p.w+2,h:p.h+2})).join('');
  const landMask=new Path2D(landPath);
  if(streetBasemap(s))this.street.draw(ctx,camera,p,{request:canvas===this.canvas&&!svg&&!rBundle&&!state.interacting,exporting:canvas!==this.canvas||svg||rBundle,scale});else{
  this.street.pause();ctx.save();ctx.beginPath();ctx.rect(domain.x,domain.y,domain.w,domain.h);ctx.clip();if(needsOcean(s)){ctx.fillStyle=DEPTH_BANDS[0][1];ctx.fillRect(domain.x,domain.y,domain.w,domain.h);}ctx.clip(landMask,'evenodd');ctx.fillStyle=s.ecologyTheme==='biomes'?'#e2e2e0':'#e9f7e4';ctx.fillRect(p.x,p.y,p.w,p.h);
  if(s.terrain){
   this.drawTiles(ctx,state,p,scale,elevationScale(s,camera,p).ramp,terrainPlan(s,camera));
  }
  ctx.restore();}const paint=new Painter(ctx,svg);
  if(svg)paint.parts.push(`<image width="${figure.width}" height="${figure.height}" href="${canvas.toDataURL('image/png')}"/>`);
  ctx.save();ctx.beginPath();ctx.rect(domain.x,domain.y,domain.w,domain.h);ctx.clip();paint.parts?.push(`<g clip-path="url(#plot)">`);
  if(coastData){
   ctx.save();ctx.clip(landMask,'evenodd');
   paint.parts?.push(`<defs><clipPath id="detail-land"><path d="${landPath}" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#detail-land)">`);
   this.drawEcology(paint,state,p,point);
   paint.parts?.push('</g>');ctx.restore();
  }else this.drawEcology(paint,state,p,point);
  this.drawOcean(paint,state,p,point,scale,landFeatures);
  const contourOccupied=s.landContours?this.drawLandContours(paint,state,p,point,landFeatures):[];
  if(!streetBasemap(s)&&(globalMap||needsOcean(s)))this.polarCoverage(paint,state,p,point);
  if(s.grid)this.graticule(paint,state,p,true);
  if(globalMap&&(s.provinces||s.provinceLabels)){
   this.admin1.load();
   if(s.provinces&&this.admin1.data){
    paint.parts?.push('<g data-layer="admin1-boundaries">');
    for(const f of visibleAdmin1(this.admin1.data,point.bounds))paint.path(admin1Path(f.geometry,point),{stroke:'#718078',width:s.provinceWidth??.55,opacity:.65});
    paint.parts?.push('</g>');
   }
  }
  if(globalMap&&s.countries!==false)paint.path(admin1Path(this.interior.countries,point),{stroke:'#64745c',width:.55,opacity:.8});
  if(coastData&&(s.towns||s.counties)){
   // Administrative geometry may extend beyond the detailed shoreline.
   ctx.save();ctx.clip(landMask,'evenodd');
   paint.parts?.push('<g data-layer="local-boundaries" clip-path="url(#detail-land)">');
   if(s.towns)paint.path(admin1Path(this.interior.towns,point),{stroke:'#546448',width:.4,opacity:.62});
   if(s.counties)paint.path(admin1Path(this.interior.counties,point),{stroke:'#3e5236',width:.8,opacity:.72});
   paint.parts?.push('</g>');ctx.restore();
  }else if(!coastData){
   if(s.towns)for(const f of this.geometry.towns.features)paint.path(pathGeometry(f.geometry,point),{stroke:'#546448',width:.4,opacity:.62});
   if(s.counties)for(const f of this.geometry.counties.features)paint.path(pathGeometry(f.geometry,point),{stroke:'#3e5236',width:.8,opacity:.72});
  }
  this.drawFreshwater(paint,state,point,p);
  if(!streetBasemap(s))paint.path(land,{stroke:'#657c54',width:.7});
  const occupied=[...contourOccupied],language=state.language||getLanguage();
  if(globalMap&&s.countryLabels){
   const blockers=[...occupied,...state.sites.map(site=>{const [x,y]=point(site.lon,site.lat);return {x,y,w:2*(s.radius||7)+8,h:2*(s.radius||7)+8};})];
   const items=(this.world?.features||[]).map(feature=>({feature,d:pathGeometry(feature.geometry,point,p),anchor:feature.properties.label?point(...feature.properties.label):null}));
   paint.parts?.push('<g data-layer="country-labels">');
   for(const label of countryLabels(paint.ctx,items,p,language,blockers,(this.world?.disputedAreas?.features||[]).map(f=>pathGeometry(f.geometry,point,p)))){occupied.push(label);paint.text(label.text,label.x,label.y+label.size*.35,{size:label.size,color:'#58615b',align:'center'});}
   paint.parts?.push('</g>');
  }
  if(globalMap&&s.provinceLabels&&this.admin1.data&&camera.zoom>=3.5){
   paint.parts?.push('<g data-layer="admin1-labels">');let labels=0;
   for(const f of this.admin1.data.labels){
    if(!overlaps(f.bbox,point.bounds))continue;
    const [x,y]=point(...f.label),a=point(f.bbox[0],f.bbox[1]),b=point(f.bbox[2],f.bbox[3]);
    if(Math.abs(b[0]-a[0])<24||Math.abs(b[1]-a[1])<14||x<p.x+12||x>p.x+p.w-12||y<p.y+12||y>p.y+p.h-12)continue;
    const text=placeName(f,language);paint.ctx.font='10px Arial';const w=paint.ctx.measureText(text).width;
    if(w>Math.max(48,Math.abs(b[0]-a[0])*1.4)||x-w/2<p.x+3||x+w/2>p.x+p.w-3||occupied.some(a=>Math.abs(x-a.x)<(w+a.w)/2+8&&Math.abs(y-a.y)<16))continue;
    if(state.sites.some(site=>{const q=point(site.lon,site.lat);return Math.abs(q[0]-x)<w/2+(s.radius||7)+4&&Math.abs(q[1]-y)<(s.radius||7)+10;}))continue;
    occupied.push({x,y,w});paint.text(text,x,y,{size:10,color:'#586958',align:'center'});if(++labels>=150)break;
   }
   paint.parts?.push('</g>');
  }
  for(const [key,on,property,size] of [['counties',s.countyLabels,'COUNTYNAME',12],['towns',s.townLabels,'TOWNNAME',9]])if(on)for(const f of this.geometry[key].features){const [x,y]=point(...f.labelPoint),text=(!['zh-Hant','zh-Hans'].includes(language)?f.properties[key==='counties'?'COUNTYENG':'TOWNENG']:null)||f.properties[property];if(x<p.x+15||x>p.x+p.w-15||y<p.y+15||y>p.y+p.h-15)continue;const w=text.length*size;if(occupied.some(a=>Math.abs(x-a.x)<(w+a.w)/2&&Math.abs(y-a.y)<14))continue;occupied.push({x,y,w});paint.text(text,x,y,{size,color:'#44593b',align:'center'});}
  let basemap=null;
  if(rBundle){if(attributionHeight(s)){const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;const c=copy.getContext('2d');c.drawImage(canvas,0,0);c.scale(scale,scale);drawMapAttribution(new Painter(c),figure,s);basemap=copy.toDataURL('image/png');}else basemap=canvas.toDataURL('image/png');}

  this.hitMarkers=[];
  for(const site of state.sites){const [x,y]=point(site.lon,site.lat);let r=s.radius+(s.autoSize?Math.max(0,site.values.length-1)*2:0);if(x<p.x-r||x>p.x+p.w+r||y<p.y-r||y>p.y+p.h+r)continue;const shape=site.values.length===1?markerShape(state.shapes,site.values[0].group):'circle';if(streetBasemap(s)||needsOcean(s)||s.rivers||s.lakes)paint.marker(x,y,r+1.5,shape,'#ffffffd9','none',0);if(site.values.length===1)paint.marker(x,y,r,shape,state.colors[site.values[0].group]);else {const total=site.values.reduce((a,b)=>a+b.value,0);let a=-Math.PI/2;for(const v of site.values){const b=a+v.value/total*Math.PI*2;paint.wedge(x,y,r,a,b,state.colors[v.group]);a=b;}paint.circle(x,y,r,'#ffffff00');}this.hitMarkers.push({x,y,r,site});
   if(s.siteNumbers&&site.id){const font=s.siteLabelSize??11;ctx.font=`600 ${font}px Arial`;const w=ctx.measureText(site.id).width+8,lx=Math.max(p.x+4,Math.min(p.x+p.w-w-4,x+r+5)),ly=Math.max(p.y+font+5,Math.min(p.y+p.h-5,y-r-3));paint.rect(lx-3,ly-font-2,w,font+6,'#fffffff0');paint.text(site.id,lx+1,ly,{size:font,weight:'600',color:'#25352d'});}
  }
  if(rBundle){paint.commands=[];paint.recordMeta={layer:'adornments',clip:true};}
  if(s.northArrow)this.northArrow(paint,state,p,point);
  if(s.scaleBar)this.scaleBar(paint,state,p,point);
  ctx.restore();paint.parts?.push('</g>');
  paint.recordMeta={layer:'frame',clip:false};
  if(s.frame){if(curved)paint.path(point.domain(),{stroke:'#4b5b43',width:1});else paint.rect(p.x,p.y,p.w,p.h,'none','#4b5b43',1);this.graticule(paint,state,p,false);}
  this.legendBoxes=[];if(s.legend)this.legend(paint,state);
  paint.recordMeta={layer:'demo',clip:false};
  if(state.demo)paint.text(tx('demoMap',{},language),p.x,figure.height-21-attributionHeight(s),{size:9,color:'#9a937c'});
  drawMapAttribution(paint,figure,s);
  if(svg){const parts=paint.parts;return {canvas,svg:`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${figure.widthCm}cm" height="${figure.heightCm}cm" viewBox="0 0 ${figure.width} ${figure.height}"><metadata>${escapeXML(mapSource(state))}; Demo data: ${state.demo}; coordinates merged to ${s.digits} decimal places; mode=${s.pieMode}; markerShapes=${escapeXML(JSON.stringify(state.shapes||{}))}; legendEdits=${escapeXML(JSON.stringify(state.legendEdits||{}))}; displayNames=${escapeXML(JSON.stringify(state.displayNames||{}))}.</metadata><defs>${paint.fontStyles()}<clipPath id="plot"><rect x="${domain.x}" y="${domain.y}" width="${domain.w}" height="${domain.h}"/></clipPath></defs>${parts.join('')}</svg>`};}
  return {canvas,...(rBundle?{recipe:{basemap,commands:paint.commands}}:{})};
 }
 drawLandContours(paint,state,p,point,features){
  const view=this.visibleTiles(state,p,terrainPlan(state.settings,state.camera)),interval=state.settings.contourInterval||500;
  const invert=point.invert?((x,y)=>point.invert(x,y)):((x,y)=>inversePosition(x,y,state.camera,p,state.settings));
  const key=JSON.stringify([state.camera,state.settings.projection,state.settings.worldCenter,p,view.z,interval]);
  const paths=this.landContours.paths(key,view,this.terrain.tiles,p,invert,interval);
  if(!paths.length)return [];
  const d=features.map(f=>pathGeometry(f.geometry,point,{x:p.x-1,y:p.y-1,w:p.w+2,h:p.h+2})).join('');
  paint.ctx.save();paint.ctx.clip(new Path2D(d),'evenodd');
  paint.parts?.push(`<defs><clipPath id="land-contours"><path d="${d}" clip-rule="evenodd"/></clipPath></defs><g data-layer="land-contours" clip-path="url(#land-contours)">`);
  for(const c of paths)paint.path(c.d,{stroke:'#79684e',width:c.level%(interval*5)===0?.8:.45,opacity:.65});
  const mask=new Path2D(d),blocked=state.sites.map(site=>{const [x,y]=point(site.lon,site.lat),r=(state.settings.radius||7)+(state.settings.autoSize?Math.max(0,(site.values?.length||1)-1)*2:0);return {x,y,w:2*r+8,h:2*r+8};});
  paint.ctx.save();paint.ctx.resetTransform();paint.ctx.font='10px Arial';
  const labels=contourLabels(paths,p,interval,{blocked,measure:text=>paint.ctx.measureText(text).width,allowed:(x,y,w)=>[-1,0,1].every(a=>[-1,0,1].every(b=>paint.ctx.isPointInPath(mask,x+a*w/2,y+b*8,'evenodd')))});
  paint.ctx.restore();
  paint.parts?.push('<g data-layer="contour-labels">');
  for(const label of labels)paint.text(label.text,label.x,label.y+3.5,{size:10,color:'#777777',align:'center'});
  paint.parts?.push('</g></g>');paint.ctx.restore();return labels;
 }
 visibleTiles(state,p,plan,scale=1){return projected(state.settings,state.camera,p)?this.projectedRaster.visible(state,p,plan,scale):this.terrain.visible(state.camera,p,plan.zoom,plan.limit);}
 drawTiles(ctx,state,p,scale,ramp,plan){
   if(projected(state.settings,state.camera,p)){this.projectedRaster.draw(ctx,state,p,scale,ramp,plan);return;}
   const camera=state.camera,s=state.settings,visible=this.terrain.visible(camera,p,plan.zoom,plan.limit),world=256*2**camera.zoom;
   for(const placement of visible.placements){
    const t=this.terrain.tiles.get(placement.key);if(t.status!=='ready')continue;
    const n=2**t.z,size=world/n,pad=size/256,x=p.x+p.w/2+(placement.x/n-camera.x)*world,y=p.y+p.h/2+(t.y/n-camera.y)*world;
    const left=Math.round(x*scale)/scale,top=Math.round(y*scale)/scale,right=Math.round((p.x+p.w/2+((placement.x+1)/n-camera.x)*world)*scale)/scale,bottom=Math.round((p.y+p.h/2+((t.y+1)/n-camera.y)*world)*scale)/scale;
    // Sample through the gutter, but paint only the core. Shared, whole-pixel
    // clip edges avoid both gutter overpainting and antialiased hairline gaps.
    ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();ctx.imageSmoothingEnabled=true;
    ctx.drawImage(this.terrain.color(t,s,ramp),x-pad,y-pad,size+2*pad,size+2*pad);ctx.restore();
   }
 }
 drawEcology(paint,state,p,point){
  const s=state.settings;if(s.ecologyTheme==='biomes'){
   this.ecology.load('biomes');paint.parts?.push('<g data-layer="biomes">');
   for(const f of this.ecology.data('biomes')?.features||[])paint.path(pathGeometry(f.geometry,point,p),{fill:biomeColor(f)});
   paint.parts?.push('</g>');
  }
  if(s.ecoregions){this.ecology.load('ecoregions');paint.parts?.push('<g data-layer="ecoregions">');for(const f of this.ecology.data('ecoregions')?.features||[])if(!f.properties.auxiliary)paint.path(outlineGeometry(f.geometry,point),{stroke:'#554d48',width:.45,opacity:.6});paint.parts?.push('</g>');}
 }
 northArrow(paint,state,p,point){
  const x=p.x+p.w-31,y=p.y+45;let angle=0;
  if(point.invert){const q=point.invert(x,y+15)||unproject(state.camera.x,state.camera.y);if(Math.abs(q[1])>84.8)return;const a=point(...q),b=point(q[0],q[1]+.05);angle=Math.atan2(b[1]-a[1],b[0]-a[0])+Math.PI/2;}
  const rotate=(dx,dy)=>[x+dx*Math.cos(angle)-dy*Math.sin(angle),y+dx*Math.sin(angle)+dy*Math.cos(angle)],a=rotate(0,0),b=rotate(-8,32),c=rotate(0,25),d=rotate(8,32),n=rotate(0,-15);
  paint.text('N',...n,{size:14,align:'center'});paint.path(`M${a}L${b}L${c}L${d}Z`,{fill:'#fff',stroke:'#344b30',width:1});paint.path(`M${a}L${b}L${c}Z`,{fill:'#344b30'});
 }
 scaleBar(paint,state,p,point){
  const camera=state.camera,lat=unproject(camera.x,camera.y)[1];let mpp=40075016.686*Math.cos(lat*Math.PI/180)/(256*2**camera.zoom),x=p.x+24,y=p.y+p.h-27;
  if(point.invert){const cx=p.x+p.w/2,cy=p.y+p.h/2,a=point.invert(cx-1,cy),b=point.invert(cx+1,cy);if(!a||!b)return;mpp=geoDistance(a,b)*6371008.8/2;x=p.x+24;}
  const target=mpp*p.w*.19,power=10**Math.floor(Math.log10(target)),nice=target/power>=5?5:target/power>=2?2:1,meters=nice*power,len=meters/mpp;if(!Number.isFinite(len)||len<1)return;
  paint.rect(x-8,y-27,len+24,point.invert?56:43,'#ffffffd9');paint.line(x,y,x+len,y,'#344b30',2);paint.line(x,y-4,x,y+4);paint.line(x+len,y-4,x+len,y+4);paint.text(meters>=1000?`${meters/1000} km`:`${meters} m`,x+len/2,y-9,{size:12,align:'center'});if(point.invert)paint.text(tx('scaleAtCenter',{},state.language||getLanguage()),x+len/2,y+17,{size:9,align:'center'});
 }
 drawOcean(paint,state,p,point,scale=1,landFeatures=[]){
  const s=state.settings;if(!needsOcean(s))return;
  const box={x:p.x-1,y:p.y-1,w:p.w+2,h:p.h+2};
  const ocean=(point.path?point.domain():`M${p.x},${p.y}h${p.w}v${p.h}h${-p.w}Z`)+landFeatures.map(f=>pathGeometry(f.geometry,point,box)).join('');
  if(!ocean)return;
  const ctx=paint.ctx;ctx.save();ctx.clip(new Path2D(ocean),'evenodd');
  paint.parts?.push(`<defs><clipPath id="ocean-mask"><path d="${ocean}" clip-rule="evenodd"/></clipPath></defs><g data-layer="ocean" clip-path="url(#ocean-mask)">`);
  paint.path(ocean,{fill:DEPTH_BANDS[0][1]});
  if(s.bathymetry){
   paint.parts?.push('<g data-layer="bathymetry">');
   const layer=document.createElement('canvas'),px=Math.floor(p.x*scale),py=Math.floor(p.y*scale);
   layer.width=Math.ceil((p.x+p.w)*scale)-px;layer.height=Math.ceil((p.y+p.h)*scale)-py;
   const lc=layer.getContext('2d');lc.translate(-px,-py);lc.scale(scale,scale);
   this.drawTiles(lc,state,p,scale,OCEAN_ELEVATION_RAMP,oceanPlan(s,state.camera));
   ctx.drawImage(layer,px/scale,py/scale,layer.width/scale,layer.height/scale);
   if(paint.parts)paint.parts.push(`<image data-source="ETOPO1-terrain-tiles" x="${px/scale}" y="${py/scale}" width="${layer.width/scale}" height="${layer.height/scale}" href="${layer.toDataURL('image/png')}"/>`);
   paint.parts?.push('</g>');
  }
  if(s.isobaths){
   this.water.load('bathymetry');
   const features=visibleWater(this.water.data('bathymetry'),point.bounds);
   paint.parts?.push('<g data-layer="isobaths">');
   for(const [depth] of DEPTH_BANDS.slice(1)){const d=features.filter(f=>f.properties.depth===depth).map(f=>outlineGeometry(f.geometry,point)).join('');if(d)paint.path(d,{stroke:s.bathymetry?'#edf6fa':'#427899',width:.45,opacity:s.bathymetry?.35:.65});}
   paint.parts?.push('</g>');
  }
  paint.parts?.push('</g>');ctx.restore();
 }
 drawFreshwater(paint,state,point,p){
  const s=state.settings,detail=s.waterDetail?this.hydroDetail.data(state.camera,point.bounds,!!point.path):null;
  const dataset=kind=>detail?{features:detail.features.filter(f=>f.properties.kind===kind)}:this.water.data(kind);
  if(s.rivers){if(!s.waterDetail)this.water.load('rivers');paint.parts?.push('<g data-layer="rivers">');for(const f of visibleWater(dataset('rivers'),point.bounds)){if(state.camera.zoom<3&&f.properties.rank>4)continue;paint.path(admin1Path(f.geometry,point),{stroke:'#3987ac',width:f.properties.rank<=3?1:.65,opacity:.9});}paint.parts?.push('</g>');}
  if(s.lakes){if(!s.waterDetail)this.water.load('lakes');paint.parts?.push('<g data-layer="lakes">');for(const f of visibleWater(dataset('lakes'),point.bounds))paint.path(pathGeometry(f.geometry,point,{x:p.x-1,y:p.y-1,w:p.w+2,h:p.h+2}),{...LAKE_STYLE,width:.5});paint.parts?.push('</g>');}
 }
 polarCoverage(paint,state,p,point){
  if(point?.path){for(const lat of [-90,90]){const d=point.path(geoCircle().center([0,lat]).radius(5).precision(2)());if(!d)continue;const id=lat<0?'south-coverage':'north-coverage';paint.ctx.save();paint.ctx.clip(new Path2D(d));paint.parts?.push(`<defs><clipPath id="${id}"><path d="${d}"/></clipPath></defs><g data-layer="polar-coverage" clip-path="url(#${id})">`);paint.path(d,{fill:'#f1f3ee'});for(let offset=-p.h;offset<p.w;offset+=18)paint.line(p.x+offset,p.y,p.x+offset+p.h,p.y+p.h,'#cbd2c4',.65,.8);paint.parts?.push('</g>');paint.ctx.restore();}return;}
  for(const gap of polarGaps(state.camera,p)){
   paint.parts?.push(`<g data-layer="polar-coverage" data-edge="${gap.edge}">`);
   paint.rect(gap.x,gap.y,gap.w,gap.h,'#f1f3ee');
   for(let offset=-gap.h;offset<gap.w;offset+=18){const a=Math.max(0,-offset),b=Math.min(gap.h,gap.w-offset);if(b>a)paint.line(gap.x+offset+a,gap.y+a,gap.x+offset+b,gap.y+b,'#cbd2c4',.65,.65);}
   if(gap.h>=24){const text=tx('polarCoverage',{edge:gap.edge},state.language||getLanguage());paint.ctx.font='10px Arial';const width=paint.ctx.measureText(text).width,size=Math.min(10,10*(gap.w-20)/Math.max(1,width));paint.rect(gap.x+gap.w/2-Math.min(width,gap.w-20)/2-5,gap.y+gap.h/2-11,Math.min(width,gap.w-20)+10,19,'#f1f3eef0');paint.text(text,gap.x+gap.w/2,gap.y+gap.h/2+3,{size,color:'#63705c',align:'center'});}
   paint.parts?.push('</g>');
  }
 }
 graticule(paint,state,p,grid){
  if(projected(state.settings,state.camera,p)){const point=projector(state.settings,state.camera,p),[lon,lat]=unproject(state.camera.x,state.camera.y),span=Math.min(360,p.w/(256*2**state.camera.zoom)*450),raw=span/8,power=10**Math.floor(Math.log10(raw)),step=(raw/power<2?1:raw/power<5?2:5)*power;
   if(grid){const extent=span>=180?[[-180,-85],[180,85]]:[[lon-span,Math.max(-85,lat-span)],[lon+span,Math.min(85,lat+span)]];paint.path(point.path(geoGraticule().extent(extent).step([step,step])()),{stroke:'#7d9470',width:.4,opacity:.35});}
   else{
    const digits=step>=1?0:Math.min(5,Math.ceil(-Math.log10(step)));let last=-Infinity;
    for(let value=Math.ceil((lon-Math.min(180,span))/step)*step;value<=lon+Math.min(180,span);value+=step){
     const wrapped=((value+180)%360+360)%360-180;let q=point(wrapped,-85);
     if(q[1]>p.y+p.h){let lo=-85,hi=85;for(let i=0;i<28;i++){const mid=(lo+hi)/2;if(point(wrapped,mid)[1]>p.y+p.h)lo=mid;else hi=mid;}q=point(wrapped,(lo+hi)/2);}
     if(q[1]<p.y||q[0]<p.x+12||q[0]>p.x+p.w-12||q[0]-last<42)continue;
     paint.text(`${wrapped.toFixed(digits)}°`,q[0],q[1]+18,{size:10,align:'center',color:'#78826d'});last=q[0];
    }
    for(let value=Math.ceil(Math.max(-85,lat-span)/step)*step;value<=Math.min(85,lat+span);value+=step){const q=point(lon-179.999,value),center=point(lon,value);if(q[1]<p.y+12||q[1]>p.y+p.h-12||center[0]<p.x)continue;const x=Math.max(p.x,q[0]);paint.text(`${value.toFixed(digits)}°`,x-10,q[1]+4,{size:10,align:'right',color:'#78826d'});}
   }
   return;
  }
  const camera=state.camera,bounds=mercatorBounds(camera,p),a=[bounds[0],bounds[3]],b=[bounds[2],bounds[1]];const nice=span=>{const raw=Math.max(1e-9,span)/5,pow=10**Math.floor(Math.log10(raw)),factor=raw/pow,step=(factor<=1?1:factor<=2?2:factor<=5?5:10)*pow;return {step,digits:step>=1?0:Math.min(5,Math.ceil(-Math.log10(step)))};};const lonTick=nice(b[0]-a[0]),latTick=nice(a[1]-b[1]);for(let lon=Math.ceil(a[0]/lonTick.step)*lonTick.step;lon<=b[0]+1e-8;lon+=lonTick.step){const x=p.x+p.w/2+((lon+180)/360-camera.x)*256*2**camera.zoom;if(grid)paint.line(x,p.y,x,p.y+p.h,'#7d9470',.35,.25);else{paint.line(x,p.y+p.h,x,p.y+p.h+5,'#4b5b43',.7);paint.text(`${wrapLongitude(lon).toFixed(lonTick.digits)}°`,x,p.y+p.h+22,{size:11,align:'center',color:'#78826d'});}}for(let lat=Math.ceil(Math.max(-85,b[1])/latTick.step)*latTick.step;lat<=Math.min(85,a[1])+1e-8;lat+=latTick.step){const [,y]=position(0,lat,camera,p);if(grid)paint.line(p.x,y,p.x+p.w,y,'#7d9470',.35,.25);else{paint.line(p.x-5,y,p.x,y,'#4b5b43',.7);paint.text(`${lat.toFixed(latTick.digits)}°`,p.x-10,y+4,{size:11,align:'right',color:'#78826d'});}}
 }
 legend(paint,state){
  const s=state.settings,language=state.language||getLanguage(),groups=state.groups.filter(group=>!state.selected||state.selected.has(group));
  this.legendBoxes=legendBlocks(s,groups.length,layout(s),state.legendEdits);
  for(const box of this.legendBoxes){
   paint.recordMeta={layer:'legend-'+box.kind,clip:false};
   const {kind,x,y,w,h,style,barHeight}=box,font=kind==='taxa'?box.font:style.font,family=LEGEND_FONTS[style.family],body={size:font,font:family,italic:style.italic,weight:style.bold?'600':'normal',color:style.color};
   const titles={taxa:tx(s.legendTitle==='groups'?'legendGroups':'legendSpecies',{},language),elevation:tx('elevation',{},language),depth:tx('waterDepth',{},language),water:tx('waterLegend',{},language),biomes:tx('biomeLegend',{},language)};
   paint.parts?.push(`<g data-legend="${kind}">`);
   if(style.background||style.border)paint.rect(x,y,w,h,style.background?'#fffffff0':'none',style.border?'#a2af9b':'none',.7);
   const title=style.title||titles[kind],titleWeight=style.titleBold?'600':'normal';
   paint.ctx.font=`${style.titleItalic?'italic ':''}${titleWeight} ${style.titleFont}px ${labelFont(title,family,style.titleItalic,titleWeight)}`;
   const titleSize=Math.min(style.titleFont,style.titleFont*(w-20)/Math.max(1,paint.ctx.measureText(title).width));
   paint.text(title,x+10,y+Math.max(24,style.titleFont+6),{size:titleSize,font:family,italic:style.titleItalic,weight:style.titleBold?'600':'normal',color:style.color});
   if(kind==='taxa'){
    groups.forEach((group,i)=>{const col=Math.floor(i/Math.max(1,box.rows)),row=i%Math.max(1,box.rows),cx=x+10+col*200,cy=y+box.head+row*box.gap;
     paint.recordMeta={layer:'legend-taxa',clip:false,taxon:group};
     paint.marker(cx+5,cy-4,box.symbol,markerShape(state.shapes,group),state.colors[group],'none',0);
     const offset=Math.max(19,box.symbol+12),maxW=200-offset-(box.columns>1?box.symbol+4:0);
     paint.legendName(taxonLabelRuns(state,group),cx+offset,cy,maxW,body);
    });
   }else if(kind==='elevation'){
    const top=y+box.barTop,altitude=elevationScale(s,state.camera,layout(s));for(let j=0;j<barHeight;j++){const e=altitude.max*(1-j/Math.max(1,barHeight-1)),c=rampColor(e,altitude.ramp);paint.rect(x+10,top+j,14,1.1,`rgb(${c.join(',')})`);}
    let last=-Infinity;for(const e of [...altitude.ticks].sort((a,b)=>b-a)){const cy=top+barHeight*(1-e/altitude.max);if(cy-last<font*1.25||e>0&&top+barHeight-cy<font*1.25)continue;paint.text(String(e),x+34,cy+4,body);last=cy;}
   }else if(kind==='depth'){
    const top=y+box.barTop,cx=x+10;paint.parts?.push('<g data-layer="depth-legend">');
    if(s.bathymetry){const gradient=paint.ctx.createLinearGradient(cx,top,cx,top+barHeight);for(const [depth,color] of OCEAN_STOPS)gradient.addColorStop(depth/OCEAN_MAX_DEPTH,color);paint.ctx.fillStyle=gradient;paint.ctx.fillRect(cx,top,12,barHeight);
     paint.record('gradient',{x:cx,y:top,w:12,h:barHeight,stops:OCEAN_STOPS.map(([depth,color])=>[depth/OCEAN_MAX_DEPTH,color])});
     paint.parts?.push(`<defs><linearGradient id="ocean-depth-gradient" x1="0" y1="0" x2="0" y2="1">${OCEAN_STOPS.map(([depth,color])=>`<stop offset="${depth/OCEAN_MAX_DEPTH*100}%" stop-color="${color}"/>`).join('')}</linearGradient></defs><rect x="${cx}" y="${top}" width="12" height="${barHeight}" fill="url(#ocean-depth-gradient)"/>`);
     let last=-Infinity;for(const depth of [0,200,...Array.from({length:10},(_,i)=>(i+1)*1000),11000]){const cy=top+barHeight*depth/OCEAN_MAX_DEPTH;if(cy-last<font*1.25||depth<11000&&top+barHeight-cy<font*1.25)continue;paint.text(String(depth),cx+18,cy+4,body);last=cy;}
    }else{let last=-Infinity;for(const [depth] of DEPTH_BANDS.slice(1)){const cy=top+barHeight*depth/OCEAN_MAX_DEPTH;if(cy-last<font*1.25)continue;paint.line(cx,cy,cx+12,cy,'#427899',.7);paint.text(String(depth),cx+18,cy+3,body);last=cy;}}
    paint.parts?.push('</g>');
   }else if(kind==='biomes'){
    const features=this.ecology.data('biomes')?.features||[];for(let i=1;i<=15;i++){
     const f=features.find(f=>Number(f.properties.biome??f.properties.id)===i),cy=y+box.barTop+(i-1)*box.biomeRow,label=tx(i===15?'biomeUnclassified':'biome'+i,{},language),wrapped=legendLines(paint.ctx,label,w-42,Math.min(font,box.biomeRow/2.5),family);
     paint.rect(x+10,cy+2,10,10,biomeColor(f));wrapped.lines.forEach((line,j)=>paint.text(line,x+27,cy+10+j*(wrapped.size+1),{...body,size:wrapped.size}));
    }
   }else{
    const cy=y+Math.max(43,style.titleFont+style.font+12);if(s.rivers){paint.line(x+10,cy-4,x+24,cy-4,'#3987ac',1.1);paint.text(tx('waterRivers',{},language),x+31,cy,body);}if(s.lakes){const cx=x+10+(s.rivers?box.waterColumn:0);paint.rect(cx,cy-11,13,9,LAKE_STYLE.fill,LAKE_STYLE.stroke,.5);paint.text(tx('waterLakes',{},language),cx+20,cy,body);}
   }
   paint.parts?.push('</g>');
  }
 }
}
export function defaultCamera(settings,bounds=[119.5,21.6,122.25,25.55],centerLongitude){return fitProjection(settings,bounds,layout(settings),centerLongitude);}
export {SOURCE,Painter};
