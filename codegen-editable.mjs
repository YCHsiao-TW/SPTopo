import {pageSize} from './page.mjs';
import {legendBlocks} from './legend.mjs';
import {csvEncode,WORLD_RAMP,RAMP,unproject} from './core.mjs';
import {selectedRecords,occurrenceCSV} from './codegen.mjs';
import {mapR} from './codegen-r.mjs?r=mixed-italics';
import {layout,terrainPlan,inversePosition,interiorBoundaries} from './map.mjs?r=editable-5';
import {mercatorBounds} from './longitude.mjs';
import {DetailLayers} from './detail-layers.mjs';
import {projected} from './projection.mjs';
import {MARKER_SHAPES,markerPath} from './markers.mjs';
import {pathVertices} from './map-recipe.mjs';
import {OCEAN_STOPS} from './water.mjs';
export function editableSettings(state,width=3000){
 const s=state.settings,p=layout(s);let bounds=mercatorBounds(state.camera,p);
 if(projected(s,state.camera,p)){const pts=[];for(let j=0;j<=32;j++)for(let i=0;i<=32;i++){const q=inversePosition(p.x+p.w*i/32,p.y+p.h*j/32,state.camera,p,s);if(q.every(Number.isFinite)&&Math.abs(q[1])<=85)pts.push(q);}const center=unproject(state.camera.x,state.camera.y)[0],xs=pts.map(q=>q[0]+360*Math.round((center-q[0])/360));bounds=[Math.min(...xs),Math.min(...pts.map(q=>q[1])),Math.max(...xs),Math.max(...pts.map(q=>q[1]))];}
 bounds=[bounds[0],Math.max(-85,bounds[1]),bounds[2],Math.min(85,bounds[3])];if(bounds[2]-bounds[0]>359)bounds=[-180,bounds[1],180,bounds[3]];
 return {legend_species:s.legendSpecies!==false,legend_elevation:s.legendElevation!==false,legend_depth:s.legendDepth!==false,map_width:p.w,auto_size:!!s.autoSize,raster_max_cells:16000000,bounds,projection:projected(s,state.camera,p)?s.projection:'mercator',central_meridian:(bounds[0]+bounds[2])/2,output_width_cm:s.pageWidth||25,output_height_cm:s.pageHeight||20,output_pixels:width,terrain:!!s.terrain,bathymetry:!!s.bathymetry,ocean:!!s.ocean,countries:s.countries!==false,country_labels:!!s.countryLabels,rivers:!!s.rivers,lakes:!!s.lakes,provinces:!!s.provinces,counties:!!s.counties,towns:!!s.towns,land_contours:!!s.landContours,contour_interval:s.contourInterval||500,hillshade:!!s.hillshade,shade_strength:s.shadow??.28,sun_direction:s.direction||315,sun_angle:s.angle||45,dem_zoom:terrainPlan(s,state.camera).zoom,max_tiles:terrainPlan(s,state.camera).limit,allow_download:true,point_size:s.radius||7,pies:!!s.pies,pie_mode:s.pieMode||'presence',digits:s.digits??5,legend:s.legend!==false,italic:s.italic!==false,grid:!!s.grid,frame:s.frame!==false,site_ids:!!s.siteNumbers,north_arrow:s.northArrow!==false,scale_bar:s.scaleBar!==false,language:state.language||'en',demo:!!state.demo};
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
 const snapshot=structuredClone(state),config=editableSettings(snapshot,width),records=selectedRecords(snapshot),groups=snapshot.groups.filter(g=>snapshot.selected.has(g)),files=[];
 const add=(name,data)=>files.push({name,data:typeof data==='string'?(name.endsWith('.csv')?data+'\n':data):JSON.stringify(data)});
 // Full global geographic layers allow independent changes of extent in R.
 const read=async name=>{const r=await fetch('./assets/'+name);if(!r.ok)throw Error('Cannot load R geographic data: '+name);return r.json();};
 const [world,boundaries,admin,rivers,lakes,fonts]=await Promise.all([renderer.world||read('world-countries.geojson'),renderer.geometry||read('boundaries.json'),read('world-admin1.json'),read('water-rivers.json'),read('water-lakes.json'),packageFonts()]);
 files.push(...fonts);
 add('country-borders.geojson',fc([{type:'Feature',properties:{},geometry:interiorBoundaries(world.features)}]));add('countries.geojson',fc(world.features));add('land.geojson',world.land||fc(world.features));add('disputes.geojson',world.disputedAreas||fc([]));add('provinces.geojson',fc(admin.features));add('counties.geojson',boundaries.counties);add('towns.geojson',boundaries.towns);add('rivers.geojson',rivers);add('lakes.geojson',lakes);
 config.coast_detail=snapshot.settings.coastDetail!==false;
 const coastCredit=config.coast_detail?await packageCoast(snapshot,renderer,config,add,read):'';
 if(config.coast_detail){
  for(const name of ['counties','towns']){
   add(name+'-interior.geojson',fc([{type:'Feature',properties:{},geometry:interiorBoundaries(boundaries[name].features)}]));
  }
 }
 const cautions=[];if(snapshot.settings.rivers||snapshot.settings.lakes)cautions.push('Water legend composition is not yet replayed in R; river and lake map layers remain editable.');if(snapshot.settings.basemap==='osm')cautions.push('Street tiles are not included: R uses geographic terrain/land layers.');
 for(const [flag,text] of [['waterDetail','Fine river/lake tiles'],['ecoregions','Ecoregion outlines'],['isobaths','Ocean isobaths'],['provinceLabels','Province labels'],['countyLabels','County labels'],['townLabels','Town labels']])if(snapshot.settings[flag])cautions.push(text+' are not implemented in this first editable R renderer; the original setting is retained in website_settings.json.');
 if(snapshot.settings.ecologyTheme==='biomes')cautions.push('Biome coloring is not implemented in this first editable R renderer.');
 const tiles=[];for(const tile of renderer.terrain?.tiles?.values()||[]){if(tile.status!=='ready'||!tile.elev)continue;const [z,x,y]=tile.key.split('/').map(Number),span=40075016.68557849/2**z,cell=span/256;let asc=`ncols 256\nnrows 256\nxllcorner ${-20037508.342789244+x*span}\nyllcorner ${20037508.342789244-(y+1)*span}\ncellsize ${cell}\nNODATA_value -99999\n`;for(let row=0;row<256;row++)asc+=Array.from(tile.elev.subarray(row*256,row*256+256),v=>Number.isFinite(v)?v.toFixed(3):'-99999').join(' ')+'\n';const name=`dem_${z}_${x}_${y}.asc`;add(name,asc);tiles.push({key:tile.key,file:name});}
 const boxes=legendBlocks(snapshot.settings,groups.length,layout(snapshot.settings),snapshot.legendEdits||{});
 for(const kind of ['taxa','elevation','depth'])if(!boxes.some(b=>b.kind===kind)){const fallback=legendBlocks({...snapshot.settings,legend:true,legendSpecies:true,legendElevation:true,legendDepth:true,terrain:true,bathymetry:kind==='depth'},groups.length,layout(snapshot.settings),snapshot.legendEdits||{}).find(b=>b.kind===kind);if(fallback)boxes.push(fallback);}
 add('layout.json',{page:pageSize(snapshot.settings),plot:layout(snapshot.settings),legends:boxes});
 add('dem_manifest.json',tiles);add('config.json',config);add('website_settings.json',{settings:snapshot.settings,camera:snapshot.camera,referenceBounds:snapshot.referenceBounds,legendEdits:snapshot.legendEdits});
 add('occurrences.csv',occurrenceCSV(records));add('source_records.csv',csvEncode([snapshot.raw.headers,...records.map(p=>p.row)]));add('taxa.csv',csvEncode([['taxon','color','shape','display_name'],...groups.map(g=>[g,snapshot.colors[g],snapshot.shapes?.[g]||'circle',snapshot.displayNames?.[g]||g])]));
 add('shapes.json',Object.fromEntries(MARKER_SHAPES.filter(x=>x!=='circle').map(x=>[x,pathVertices(markerPath(x,0,0,100)).map(p=>p.points.map(q=>q.map(v=>v/100)))])));
 add('palettes.json',{elevation:snapshot.settings.mapScope==='taiwan'?RAMP:WORLD_RAMP,depth:OCEAN_STOPS});add('export_notes.json',cautions);add('map.R',mapR(snapshot,{width}));
 add('install_packages.R','required <- c("sf", "terra", "ggplot2", "jsonlite", "png", "showtext", "sysfonts", "systemfonts")\nmissing <- required[!vapply(required, requireNamespace, logical(1), quietly=TRUE)]\nif(length(missing)) install.packages(missing, repos="https://cloud.r-project.org")\n');
 add('packages.txt','R packages: sf, terra, ggplot2, jsonlite, png, showtext, sysfonts, systemfonts. Install R separately. Linux sf/terra may require GDAL, GEOS and PROJ development libraries.\n');
 const sources=[
  coastCredit?'Coastline and land mask: '+coastCredit+' (ODbL 1.0). Source snapshot and processing in coast-detail/index.json.':'Land mask and coastline: bundled Natural Earth land geometry.',
  config.countries||config.country_labels?'Country boundaries and names: Natural Earth Admin 0 Countries 5.1.1; disputed areas for label placement: Natural Earth 1:10m.':null,
  config.counties||config.towns?'Local administrative boundaries: Taiwan Atlas 2021.9.20 / MOI NLSC.':null,
  config.provinces?'Province boundaries: Natural Earth Admin 1 5.1.0.':null,
  config.rivers||config.lakes?'Freshwater vectors: Natural Earth 5.0.0 (1:10 million).':null,
  config.terrain||config.bathymetry||config.land_contours?'Elevation/depth: Mapzen/AWS Terrarium, USGS SRTM and GMTED2010, NOAA ETOPO1. Missing DEM tiles may be downloaded from elevation-tiles-prod.s3.amazonaws.com.':null
 ];
 add('SOURCES.txt',sources.filter(Boolean).join('\n')+'\n');
 add('README.txt',`SPTopo — editable geographic R package v4\n\n解壓縮後執行 install_packages.R，再於此資料夾執行 map.R。\n修改 map.R 開頭 overrides 或 config.json；更換 occurrences.csv 的 longitude,latitude,species 即可重新製圖。\n地圖範圍、投影、圖層、色階、等高線、樣點與圖例由 R 重新計算，無須回網站。\n\nRun install_packages.R once, then Rscript map.R from this folder (or Source map.R in RStudio).\nEdit overrides at the top of map.R or config.json. Replace occurrences.csv; original WGS84 coordinates are reprojected every run. taxa.csv controls colors, shapes and display names. Mixed italics are saved in layout.json and applied when the text still matches the display name. New taxa receive stable fallback colors. Edit palettes.json for terrain/depth colors.\nCoastline and land mask use the same OSM vectors as the website. The package includes the current coastline tiles and a global overview. If you change the bounds, missing regional coastline tiles can be downloaded and cached when allow_download is true. Set coast_detail to FALSE to use the bundled generalized land layer. Each map produced with the OSM coast carries its attribution.\nGlobal vector files are bundled. Decoded DEM tiles are cached as georeferenced ASCII grids. Missing tiles are downloaded if allow_download is true; otherwise the script stops with an actionable error. Set dem_zoom to control resolution; tile requests are capped and zoom is lowered if necessary. Raster data are reprojected in R, not screenshots. Output PNG/PDF/SVG plus a run_settings.json and sessionInfo.txt are saved in a unique output/run_... folder; output/map.png is also updated after a successful run. R prints the absolute path. Source map.R directly; it selects its own package directory even if another package was used previously.\n\nDifferences from website: initial geographic bounds approximate curved-projection views; label placement/typography and legend layout are recalculated. Country names use a conservative text rectangle to avoid disputed areas; placement differs from the website. Species legends use the exported marker silhouettes. Legend positions, fonts and sizes are replayed from layout.json; installed font families can differ between computers. Edit layout.json to change them in R. Contour height labels are not yet included. Site IDs are recalculated after grouping. Ocean and elevation have separate legends.\n\nUnsupported selected options (also printed by R):\n${cautions.join('\n')||'None'}\n\nUnicode labels: save edited CSV files as UTF-8. The package includes Liberation Sans, Serif and Mono for accented names and common scientific symbols. R verifies glyph coverage, using system fonts for other scripts such as Chinese. Optional overrides$font_file can select a local TTF/OTF/TTC. Missing glyph coverage causes a clear error instead of an apparently successful output with squares. font_report.txt records the selected fonts. PNG/PDF/SVG use showtext; text in PDF/SVG is converted to outlines and cannot be edited as text in a vector editor. Change labels in the R package and rerun. Latin species names keep their serif/italic settings.\n\nKeep SOURCES.txt with redistributed output. Demo records, when present, are synthetic.\n`);
 return {files,config};
}
