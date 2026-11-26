import {effectiveMapSettings,streetBasemap} from './basemap-settings.mjs';
import {FRESHWATER_STYLE,FRESHWATER_SOURCE} from './freshwater.mjs';
import {pageSize} from './page.mjs';
import {legendBlocks} from './legend.mjs';
import {csvEncode,WORLD_RAMP,unproject} from './core.mjs';
import {selectedRecords,occurrenceCSV,createMapPackage} from './codegen.mjs';
import {mapR} from './codegen-r.mjs?r=mixed-italics';
import {layout,terrainPlan,inversePosition,interiorBoundaries} from './map.mjs?r=editable-5';
import {mercatorBounds} from './longitude.mjs';
import {DetailLayers} from './detail-layers.mjs';
import {projected} from './projection.mjs';
import {MARKER_SHAPES,markerPath} from './markers.mjs';
import {pathVertices} from './map-recipe.mjs';
import {OCEAN_STOPS} from './water.mjs';
import {tx} from './i18n.mjs';
export function editableSettings(state,width=3000){
 const s=state.settings,p=layout(s);let bounds=mercatorBounds(state.camera,p);
 const language=state.language||'en';
 const label=key=>tx(key,{},language);
 const figureLabels={taxa:label('legendSpecies'),elevation:label('elevation'),depth:label('waterDepth'),water:label('waterLegend'),water_rivers:label('waterRivers'),water_lakes:label('waterLakes')};
 if(projected(s,state.camera,p)){const pts=[];for(let j=0;j<=32;j++)for(let i=0;i<=32;i++){const q=inversePosition(p.x+p.w*i/32,p.y+p.h*j/32,state.camera,p,s);if(q.every(Number.isFinite)&&Math.abs(q[1])<=85)pts.push(q);}const center=unproject(state.camera.x,state.camera.y)[0],xs=pts.map(q=>q[0]+360*Math.round((center-q[0])/360));bounds=[Math.min(...xs),Math.min(...pts.map(q=>q[1])),Math.max(...xs),Math.max(...pts.map(q=>q[1]))];}
 bounds=[bounds[0],Math.max(-85,bounds[1]),bounds[2],Math.min(85,bounds[3])];if(bounds[2]-bounds[0]>359)bounds=[-180,bounds[1],180,bounds[3]];
 return {figure_labels:figureLabels,legend_species:s.legendSpecies!==false,legend_elevation:s.legendElevation!==false,legend_depth:s.legendDepth!==false,map_width:p.w,auto_size:!!s.autoSize,raster_max_cells:16000000,bounds,projection:projected(s,state.camera,p)?s.projection:'mercator',central_meridian:(bounds[0]+bounds[2])/2,output_width_cm:s.pageWidth||25,output_height_cm:s.pageHeight||20,output_pixels:width,terrain:!!s.terrain,bathymetry:!!s.bathymetry,ocean:!!s.ocean,countries:s.countries!==false,country_labels:!!s.countryLabels,freshwater:!!effectiveMapSettings(s).freshwater,legend_water:s.legendWater!==false,provinces:!!s.provinces,land_contours:!!s.landContours,contour_interval:s.contourInterval||500,hillshade:!!s.hillshade,shade_strength:s.shadow??.28,sun_direction:s.direction||315,sun_angle:s.angle||45,dem_zoom:terrainPlan(s,state.camera).zoom,max_tiles:terrainPlan(s,state.camera).limit,allow_download:true,point_size:s.radius||7,pies:!!s.pies,pie_mode:s.pieMode||'presence',digits:s.digits??5,legend:s.legend!==false,italic:s.italic!==false,grid:!!s.grid,frame:s.frame!==false,site_ids:!!s.siteNumbers,north_arrow:s.northArrow!==false,scale_bar:s.scaleBar!==false,language,demo:!!state.demo};
}
const fc=features=>({type:'FeatureCollection',features});
const FONT_FILES=['Sans','Serif','Mono'].flatMap(family=>
 ['Regular','Italic','Bold','BoldItalic'].map(style=>`Liberation${family}-${style}.ttf`)
).concat('OFL.txt');

async function packageFonts(){
 return Promise.all(FONT_FILES.map(async name=>{
  const response=await fetch('./assets/r-fonts/'+name);
  if(!response.ok)throw Error('Could not load R font: '+name);
  return {name:'fonts/'+name,data:new Uint8Array(await response.arrayBuffer())};
 }));
}

async function packageCoast(state,renderer,config,add,read){
 const directory='coast-detail';
 const layers=renderer.coastDetail?.index?renderer.coastDetail:new DetailLayers(directory,()=>{});
 const index=layers.index??await read(directory+'/index.json');
 layers.index=index;
 const curved=projected(state.settings,state.camera,layout(state.settings));
 const files=layers.plan(state.camera,config.bounds,curved);
 const siteBase=globalThis.document?.baseURI||'https://world-biotopo-yc.yuchunhsiao1001.chatgpt.site/';
 const baseUrl=new URL('./assets/'+directory+'/',siteBase).href;
 add(directory+'/index.json',index);
 add(directory+'/selection.json',{bounds:config.bounds,projection:config.projection,files,baseUrl});
 for(const file of new Set([index.overview,...files])){
  const raw=layers.files.get(file)?.data??await read(directory+'/'+file);
  add(directory+'/'+file+'.geojson',raw);
 }
 return index.source.attribution+' · '+index.source.copyright;
}
export async function createEditableMapPackage(state,renderer,{width=3000}={}){
 if(streetBasemap(state.settings))return createMapPackage(state,renderer,{width});
 const snapshot=structuredClone(state),config=editableSettings(snapshot,width),records=selectedRecords(snapshot),groups=snapshot.groups.filter(g=>snapshot.selected.has(g)),files=[];
 const add=(name,data)=>files.push({name,data:typeof data==='string'?(name.endsWith('.csv')?data+'\n':data):JSON.stringify(data)});
 // Full global geographic layers allow independent changes of extent in R.
 const read=async name=>{const r=await fetch('./assets/'+name);if(!r.ok)throw Error('Cannot load R geographic data: '+name);return r.json();};
 const [world,admin,fonts]=await Promise.all([
  renderer.world||read('world-countries.geojson'),
  renderer.admin1?.data||read('world-admin1.json'),
  packageFonts(),
 ]);
 files.push(...fonts);
 add('country-borders.geojson',fc([{type:'Feature',properties:{},geometry:interiorBoundaries(world.features)}]));
 add('countries.geojson',fc(world.features));
 add('land.geojson',world.land||fc(world.features));
 add('disputes.geojson',world.disputedAreas||fc([]));
 add('provinces.geojson',fc(admin.features));
 if(config.freshwater){
  const selection=renderer.freshwater?.visible(effectiveMapSettings(snapshot.settings),snapshot.camera,layout(snapshot.settings));
  if(!selection)throw Error('詳細地理圖層尚未載入完成。');
  const license=await fetch('./assets/freshwater/ODbL-1.0.txt');
  if(!license.ok)throw Error('Freshwater licence could not be loaded.');
  add('freshwater-ODbL-1.0.txt',await license.text());
  add('freshwater.geojson',fc(selection.features));
  add('freshwater-source.json',{source:selection.source,level:selection.level,files:selection.files,bounds:config.bounds,projection:config.projection,central_meridian:config.central_meridian,features:selection.features.length,styles:FRESHWATER_STYLE});
 }
 config.coast_detail=snapshot.settings.coastDetail!==false;
 const coastCredit=config.coast_detail?await packageCoast(snapshot,renderer,config,add,read):'';
 const cautions=[];
 for(const [flag,text] of [['isobaths','Ocean isobaths'],['provinceLabels','Province labels']])if(snapshot.settings[flag])cautions.push(text+' are not implemented in this first editable R renderer; the original setting is retained in website_settings.json.');
 const tiles=[];for(const tile of renderer.terrain?.tiles?.values()||[]){if(tile.status!=='ready'||!tile.elev)continue;const [z,x,y]=tile.key.split('/').map(Number),span=40075016.68557849/2**z,cell=span/256;let asc=`ncols 256\nnrows 256\nxllcorner ${-20037508.342789244+x*span}\nyllcorner ${20037508.342789244-(y+1)*span}\ncellsize ${cell}\nNODATA_value -99999\n`;for(let row=0;row<256;row++)asc+=Array.from(tile.elev.subarray(row*256,row*256+256),v=>Number.isFinite(v)?v.toFixed(3):'-99999').join(' ')+'\n';const name=`dem_${z}_${x}_${y}.asc`;add(name,asc);tiles.push({key:tile.key,file:name});}
 const boxes=legendBlocks(snapshot.settings,groups.length,layout(snapshot.settings),snapshot.legendEdits||{});
 for(const kind of ['taxa','elevation','depth'])if(!boxes.some(b=>b.kind===kind)){const fallback=legendBlocks({...snapshot.settings,legend:true,legendSpecies:true,legendElevation:true,legendDepth:true,terrain:true,bathymetry:kind==='depth'},groups.length,layout(snapshot.settings),snapshot.legendEdits||{}).find(b=>b.kind===kind);if(fallback)boxes.push(fallback);}
 add('layout.json',{page:pageSize(snapshot.settings),plot:layout(snapshot.settings),legends:boxes});
 add('dem_manifest.json',tiles);add('config.json',config);add('website_settings.json',{settings:snapshot.settings,camera:snapshot.camera,referenceBounds:snapshot.referenceBounds,legendEdits:snapshot.legendEdits});
 add('occurrences.csv',occurrenceCSV(records));add('source_records.csv',csvEncode([snapshot.raw.headers,...records.map(p=>p.row)]));add('taxa.csv',csvEncode([['taxon','color','shape','display_name'],...groups.map(g=>[g,snapshot.colors[g],snapshot.shapes?.[g]||'circle',snapshot.displayNames?.[g]||g])]));
 add('shapes.json',Object.fromEntries(MARKER_SHAPES.filter(x=>x!=='circle').map(x=>[x,pathVertices(markerPath(x,0,0,100)).map(p=>p.points.map(q=>q.map(v=>v/100)))])));
 add('palettes.json',{elevation:WORLD_RAMP,depth:OCEAN_STOPS});add('export_notes.json',cautions);add('map.R',mapR(snapshot,{width}));
 add('install_packages.R','required <- c("sf", "terra", "ggplot2", "jsonlite", "png", "showtext", "sysfonts", "systemfonts")\nmissing <- required[!vapply(required, requireNamespace, logical(1), quietly=TRUE)]\nif(length(missing)) install.packages(missing, repos="https://cloud.r-project.org")\n');
 add('packages.txt','R packages: sf, terra, ggplot2, jsonlite, png, showtext, sysfonts, systemfonts. Install R separately. Linux sf/terra may require GDAL, GEOS and PROJ development libraries.\n');
 const sources=[
  coastCredit?'Coastline and land mask: '+coastCredit+' (ODbL 1.0). Source snapshot and processing in coast-detail/index.json.':null,
  'Generalized land and coastline (coast_detail = FALSE): Natural Earth Admin 0 Countries 5.1.1 (1:50 million).',
  config.countries||config.country_labels?'Country boundaries and names: Natural Earth Admin 0 Countries 5.1.1; disputed areas for label placement: Natural Earth 1:10m.':null,
  config.provinces?'Province boundaries: Natural Earth Admin 1 5.1.0.':null,
  config.freshwater?FRESHWATER_SOURCE+' See freshwater-source.json and freshwater-ODbL-1.0.txt.':null,
  config.terrain||config.bathymetry||config.land_contours?'Elevation/depth: Mapzen/AWS Terrarium, USGS SRTM and GMTED2010, NOAA ETOPO1. Missing DEM tiles may be downloaded from elevation-tiles-prod.s3.amazonaws.com.':null
 ];
 add('SOURCES.txt',sources.filter(Boolean).join('\n')+'\n');
 add('README.txt',`SPTopo R map

1. Extract the ZIP. Run Rscript install_packages.R once to install missing packages.
2. Run Rscript map.R, or open map.R in RStudio and choose Source.
3. Find PNG, PDF and SVG in output/. PDF and SVG require Cairo.

Edit config.json or the overrides in map.R. To map new records, replace occurrences.csv with a UTF-8 CSV containing longitude, latitude and species. Coordinates use WGS84 decimal degrees. Edit taxa.csv for symbol and label settings.

In config.json, set "allow_download": false to use local files only. Set "coast_detail": false for the generalized Natural Earth coastline.

The freshwater data and scale are recorded in freshwater-source.json. Export another ZIP after changing the extent or projection. The included freshwater layer works offline.

See SOURCES.txt for data attribution and export_notes.json for differences from the web map.
`);
 return {files,config};
}
