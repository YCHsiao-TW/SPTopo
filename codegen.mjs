import {effectiveMapSettings,streetBasemap} from './basemap-settings.mjs';
import {csvEncode} from './core.mjs';
import {mapR} from './codegen-snapshot-r.mjs';
import {pageSize,outputSize} from './page.mjs';
import {layout,position,mapSource} from './map.mjs';
import {MARKER_SHAPES,markerPath,markerShape} from './markers.mjs';
import {pathVertices} from './map-recipe.mjs';
import {needsOcean} from './water.mjs';

export function selectedRecords(state){return state.valid.filter(p=>state.selected.has(p.group));}
export function occurrenceCSV(points){return csvEncode([['longitude','latitude','species','source_line'],...points.map(p=>[p.lon,p.lat,p.group,p.line])])+'\r\n';}
export function mapPointRows(state){
 const s=state.settings,p=layout(s),rows=[];
 for(const [index,site] of state.sites.entries()){
  const [x,y]=position(site.lon,site.lat,state.camera,p,s),radius=s.radius+(s.autoSize?Math.max(0,site.values.length-1)*2:0);
  if(![x,y,radius].every(Number.isFinite)||x<p.x-radius||x>p.x+p.w+radius||y<p.y-radius||y>p.y+p.h+radius)continue;
  for(const v of site.values)rows.push([String(index+1),site.id||'',site.lon,site.lat,x,y,radius,v.group,v.value,v.count]);
 }
 return [['site_key','site_id','longitude','latitude','map_x','map_y','radius','taxon','value','records'],...rows];
}
export function createMapPackage(state,renderer,{width=3000,createdAt=new Date().toISOString(),readmeIntro=''}={}){
 // Snapshot before rendering/ZIP work so navigation or taxon changes cannot mix exports.
 const snapshot=structuredClone({...state,interacting:false}),page=pageSize(snapshot.settings),output=outputSize(snapshot.settings,width);
 const records=selectedRecords(snapshot),groups=snapshot.groups.filter(g=>snapshot.selected.has(g));
 const result=renderer.render(snapshot,{canvas:document.createElement('canvas'),width,rBundle:true});
 if(!result.recipe?.basemap||!Array.isArray(result.recipe.commands))throw Error('製圖資料不完整，請重新載入後再試。');
 const source=mapSource(snapshot),scene={application:'WorldBioTopoMaps map recipe',version:1,createdAt,page,plot:layout(snapshot.settings),output,
  demonstrationData:!!snapshot.demo,basemap:'basemap.png',pointHalo:!!(streetBasemap(snapshot.settings)||needsOcean(effectiveMapSettings(snapshot.settings))||effectiveMapSettings(snapshot.settings).rivers||effectiveMapSettings(snapshot.settings).lakes),siteLabelSize:snapshot.settings.siteLabelSize??11,
  shapes:Object.fromEntries(MARKER_SHAPES.filter(s=>s!=='circle').map(s=>[s,pathVertices(markerPath(s,0,0,100)).map(p=>({...p,points:p.points.map(q=>q.map(n=>n/100))}))])),
  commands:result.recipe.commands,source,coordinateNotes:'map_x/map_y are fixed-view logical drawing positions, not a geographic CRS. Longitude/latitude are WGS84. Map sites use the website rounding/merging settings; occurrences.csv preserves original validated coordinates.',
  settings:snapshot.settings,camera:snapshot.camera,sourceColumns:snapshot.columns,sourceFile:snapshot.filename,language:snapshot.language,records:records.length};
 const points=csvEncode(mapPointRows(snapshot))+'\r\n';
 const taxa=csvEncode([['taxon','color','shape','display_name'],...groups.map(g=>[g,snapshot.colors[g],markerShape(snapshot.shapes,g),snapshot.displayNames?.[g]??g])])+'\r\n';
 const script=mapR(snapshot,{width});
 const installer=`# SPTopo — optional package setup
# map.R performs the same installation automatically. Internet is needed only for missing packages.
required <- c("jsonlite", "png")
missing <- required[!vapply(required, requireNamespace, logical(1), quietly = TRUE)]
if (length(missing)) install.packages(missing, repos = "https://cloud.r-project.org")
if (any(!vapply(required, requireNamespace, logical(1), quietly = TRUE))) stop("Install jsonlite and png, then retry.")
message("Required R packages are ready.")
`;
 const readme=readmeIntro+'\n\nSPTopo — R map package\n\nRUN\n1. Unzip all files into one folder.\n2. Open map.R in RStudio/Positron and Source it, or run Rscript map.R.\n3. If asked, select map_scene.json from this same folder.\n4. Missing jsonlite/png packages are installed from CRAN on the first run (internet required). R needs Cairo graphics support. You may also run install_packages.R separately. Package names are listed in packages.txt; OS-specific package binaries are not bundled. There are no geographic-data downloads. OSM street maps, when selected, are included only as a static current-view image, never as reusable tile archives; retain the attribution printed on the map.\n5. PNG, PDF and SVG are written to a new output/map_* folder.\n\nEDIT\n- map.R config: physical width, PNG pixels, point/text scales, legend switch, site IDs, font and legend italics.\n- taxa.csv: taxon keys must stay unchanged; edit hex color, shape or display_name.\n- map_points.csv: grouped sites and pie weights, with fixed-view logical map_x/map_y positions; not a geographic layer.\n- map_scene.json: editable legend/annotation drawing instructions and available marker silhouettes.\n- occurrences.csv: selected original valid coordinates in WGS84 (longitude,latitude,species,source_line).\n- source_records.csv: the same selected original CSV records. Column names/order are preserved.\n- map_settings.json: website settings for this export.\n\nREPRODUCTION AND LIMITS\nThe basemap includes the current terrain, ocean, ecological/administrative layers, grid and place names as one PNG. R redraws symbols, co-occurrence pies, site IDs, legends, frame, coordinate labels, scale bar and north arrow with grid. Most overlays are vector graphics in PDF/SVG; the depth gradient and basemap are raster. Fonts and text metrics can differ across computers, including missing glyphs; choose an installed font covering your labels.\nThis is a fixed geographic view, not a general GIS/analysis script. To change the projection, extent, geographic data or coordinates, make the changes on the website and download a new package. Increasing output size cannot add terrain precision. Long edited labels or large font scales may need manual layout adjustment. Changes to taxa.csv colors/shapes are shared by map points and the taxon legend; pie symbols remain circular.\n'+(snapshot.demo?'\nDEMONSTRATION DATA: these records are synthetic, not biological observations.\n':'')+'\nSOURCE\n'+source+'\n\nR grid documentation: https://stat.ethz.ch/R-manual/R-patched/library/grid/html/00Index.html\n';
 const settings={application:'TaiwanBioTopoMaps',version:1,language:snapshot.language,settings:snapshot.settings,camera:snapshot.camera,referenceBounds:snapshot.referenceBounds,columns:snapshot.columns,colors:snapshot.colors,shapes:snapshot.shapes,legendEdits:snapshot.legendEdits,displayNames:snapshot.displayNames,analysis:snapshot.analysis,selected:groups};
 const basemap=Uint8Array.from(atob(result.recipe.basemap.split(',')[1]),c=>c.charCodeAt(0));
 return {scene,script,points,taxa,files:[{name:'map.R',data:script},{name:'install_packages.R',data:installer},{name:'packages.txt',data:'Runtime: R with Cairo graphics support (install R separately).\nIncluded with R: grid, grDevices, stats, utils.\nCRAN packages: jsonlite, png.\nmap.R automatically installs missing CRAN packages; install_packages.R is also provided for optional setup.\nFirst-time installation requires internet. Platform-specific package binaries are not bundled.\n'},{name:'basemap.png',data:basemap},{name:'map_scene.json',data:JSON.stringify(scene)+'\n'},{name:'map_points.csv',data:points},{name:'taxa.csv',data:taxa},{name:'occurrences.csv',data:occurrenceCSV(records)},{name:'source_records.csv',data:csvEncode([snapshot.raw?.headers||[],...records.map(p=>p.row)])+'\r\n'},{name:'map_settings.json',data:JSON.stringify(settings,null,2)+'\n'},{name:'SOURCES.txt',data:source+'\n'},{name:'README.txt',data:readme}]};
}
