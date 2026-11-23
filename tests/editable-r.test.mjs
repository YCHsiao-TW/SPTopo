import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createEditableMapPackage} from '../dist/codegen-editable.mjs';
import {parseCSV,normalizeRows,detectColumns,decodeTerrarium,groupSites} from '../dist/core.mjs';
import {defaultCamera,MapRenderer} from '../dist/map.mjs';
const root=path.resolve('dist');globalThis.fetch=async url=>new Response(await fs.readFile(path.resolve(root,url)));
const authorLabel='Áń–García · Ægir Øster Åse · ČĎĚŇŘŠŤŮÝŽ · ÄÖẞÜ · ÀÂÆÇÉÈÊËÎÏÔŒÛÙÜŸ · Çağrı Dağı İpek Şen · ĂÂÎȘȚ · ♂♀ ± β · Jose\u0301';
const raw=parseCSV('longitude,latitude,species\n121,24,A\n121,24,B\n120.8,23.5,A\n121.5,25,B'),columns=detectColumns(raw.headers),{valid}=normalizeRows(raw,columns);
// Reuse the bundled global coast when the integration cases change their extent offline.
const settings={mapScope:'world',coastDetail:false,frame:true,northArrow:true,scaleBar:true,italic:true,grid:false,terrain:false,countries:true,countryLabels:true,radius:7,pies:true,legend:true,ocean:true,pageWidth:25,pageHeight:20,projection:'mercator'};
const state={settings,raw,columns,valid,groups:['A','B'],selected:new Set(['A','B']),colors:{A:'#0072b2',B:'#d55e00'},shapes:{A:'triangle',B:'square'},camera:defaultCamera(settings,[119,21,123,26]),language:'en',legendEdits:{taxa:{x:78,y:8,font:15,family:'sans',title:'Observed taxa'},elevation:{x:80,y:70}}};
state.displayNames={A:authorLabel};
const nameRuns={A:[{text:authorLabel.slice(0,9),italic:true},{text:authorLabel.slice(9),italic:false}]};
state.legendEdits.taxa.nameRuns=nameRuns;
const native=createRequire(import.meta.url)(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'@napi-rs/canvas'));const tiles=new Map();
for(const key of ['1/0/0','1/0/1','1/1/0','1/1/1']){const img=await native.loadImage(path.join(root,'assets/terrain',key+'.png')),c=native.createCanvas(256,256),ctx=c.getContext('2d');ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,256,256).data;tiles.set(key,{key,status:'ready',elev:Float32Array.from({length:65536},(_,i)=>decodeTerrarium(...data.subarray(i*4,i*4+3)))});}
const bundle=await createEditableMapPackage(state,{terrain:{tiles}},{width:900});const folder=path.resolve('qa/editable-r');await fs.mkdir(folder,{recursive:true});for(const f of bundle.files){
 const target=path.join(folder,f.name);
 await fs.mkdir(path.dirname(target),{recursive:true});
 await fs.writeFile(target,f.data);
}
assert.ok(!bundle.files.some(f=>f.name==='basemap.png'));assert.ok(bundle.files.find(f=>f.name==='map.R').data.includes('st_transform(sites,crs_out)'));
assert.equal(parseCSV(bundle.files.find(f=>f.name==='taxa.csv').data).rows[0][3],authorLabel);
assert.equal(bundle.files.filter(f=>f.name.endsWith('.ttf')).length,12);
assert.ok(bundle.files.some(f=>f.name==='fonts/OFL.txt'));
assert.ok(bundle.files.some(f=>f.name==='country-borders.geojson'));
assert.ok(bundle.config.map_width>0);
const savedLayout=JSON.parse(bundle.files.find(f=>f.name==='layout.json').data);
const taxaLayout=savedLayout.legends.find(b=>b.kind==='taxa');
assert.deepEqual(taxaLayout.style.nameRuns,nameRuns);
assert.match(bundle.files.find(f=>f.name==='map.R').data,/runs=st\$nameRuns\[\[taxa\$taxon\[i\]\]\]/);
assert.equal(taxaLayout.style.title,'Observed taxa');assert.equal(taxaLayout.style.font,15);
assert.equal(taxaLayout.x,savedLayout.page.width*.78);assert.equal(taxaLayout.y,savedLayout.page.height*.08);
assert.ok(savedLayout.legends.some(b=>b.kind==='elevation'),'A later terrain toggle must have a legend template');
assert.ok(savedLayout.plot.w>0&&savedLayout.plot.h>0);
assert.match(bundle.files.find(f=>f.name==='map.R').data,/cfg\$output_pixels\*\.9/);
globalThis.Path2D=native.Path2D;globalThis.document={createElement:()=>native.createCanvas(1,1)};
const canvas=native.createCanvas(1,1),web=new MapRenderer(canvas,()=>{});await web.init();
await web.water.load('bathymetry');
web.render({...state,sites:groupSites(valid,5,'presence',true)},{width:900});
await fs.writeFile(path.join(folder,'website.png'),canvas.toBuffer('image/png'));
console.log('Package and website comparison image generated');

if(process.env.SPTOPO_RUN_R==='1'){
 const generated=bundle.files.find(f=>f.name==='map.R').data;
 const fontSetup=generated.slice(generated.indexOf('# Unicode labels use'),generated.indexOf('notes <- jsonlite::fromJSON'));
 const smoke=path.join(folder,'font-smoke.R');
 await fs.writeFile(smoke,`cfg<-list()\n${fontSetup}\n
 stopifnot(identical(font_for("Species A","serif"),"serif"))
 family<-font_for("物種 海拔（m） 臺灣")
 stopifnot(grepl("^sptopo_unicode_",family),length(font_log)>0)
 author<-read_utf8_csv("taxa.csv")$display_name[1]
 stopifnot(identical(author,${JSON.stringify(authorLabel)}))
 for(f in c("sans","serif","mono")){
   for(face in c("plain","bold","italic","bold.italic")){
     selected<-font_for(author,f,face)
     stopifnot(grepl("^sptopo_unicode_",selected))
   }
 }
 latin<-font_for(author,"serif","italic")
 stopifnot(any(endsWith(font_log,"LiberationSerif-Italic.ttf")))
 cfg$font_file<-"missing-test-font.ttf"
 stopifnot(inherits(try(font_for("物種"),silent=TRUE),"try-error"))
 cfg$font_file<-NULL
 for(ext in c("png","pdf","svg")){
 file<-paste0("font-smoke.",ext)
 if(ext=="png")png(file,width=900,height=350,res=150)
 if(ext=="pdf")cairo_pdf(file,width=6,height=350/150)
 if(ext=="svg")svg(file,width=6,height=350/150)
 showtext::showtext_opts(dpi=if(ext=="png")150 else 72)
 showtext::showtext_begin()
 grid::grid.text("物種   海拔（m）   臺灣",y=.65,gp=grid::gpar(fontfamily=family,fontsize=22))
 grid::grid.text(substr(author,1,31),y=.3,gp=grid::gpar(fontfamily=latin,fontsize=22))
 showtext::showtext_end();dev.off()
 stopifnot(file.info(file)$size>1000)
 }
 `);
 execFileSync('Rscript',[smoke],{cwd:folder,encoding:'utf8',timeout:120000});

 const original=await fs.readFile(path.join(folder,'map.R'),'utf8');
 const arrowCheck='stopifnot(all(is.finite(nn)), abs(theta)<1e-5, all(is.finite(as.matrix(arrow(rbind(c(0,0),c(-8,-32)))))))';
 const globalArrow='bounds=c(-180,-85,180,85),central_meridian=0,terrain=FALSE,country_labels=FALSE';
 const cases=[
 ['baseline','terrain=FALSE'],
 ['terrain','bounds=c(115,18,128,30),projection="mercator",central_meridian=121,terrain=TRUE,bathymetry=TRUE,dem_zoom=1,allow_download=FALSE,hillshade=TRUE,land_contours=TRUE'],
 ['contours-only','bounds=c(115,18,128,30),central_meridian=121,terrain=FALSE,bathymetry=FALSE,land_contours=TRUE,contour_interval=100,dem_zoom=1,allow_download=FALSE','mercator',
  'stopifnot(nrow(contours)>0L, !any(vapply(p$layers,function(layer) inherits(layer$geom,"GeomRaster"),logical(1))))'],
 ['denmark','bounds=c(7,54,16,59),central_meridian=11.5,terrain=FALSE','mercator',
  'stopifnot(!has_disputes, "Denmark" %in% labels$label)'],
 ['equal-earth-arrow',globalArrow+',projection="equalEarth"','equalEarth',arrowCheck],
 ['robinson-arrow',globalArrow+',projection="robinson"','robinson',arrowCheck],
 ['pacific','bounds=c(160,-30,-140,60),projection="equalEarth",central_meridian=180,terrain=TRUE,bathymetry=TRUE,dem_zoom=1,allow_download=FALSE','equalEarth'],
 ['japan','bounds=c(125,25,148,46),projection="robinson",central_meridian=135,terrain=FALSE','robinson']];
 for(const [name,options,projection='mercator',checks=''] of cases){
  if(name==='japan')await fs.writeFile(path.join(folder,'occurrences.csv'),'longitude,latitude,species\n139.69,35.68,New species\n135.5,34.69,New species\n');
  const script=original.replace(/overrides <- list\([\s\S]*?\n\)/,'overrides <- list('+options+',output_pixels=900)')+'\n'+checks;
  const file=path.join(folder,name+'.R');await fs.writeFile(file,script);
  const log=execFileSync('Rscript',[file],{encoding:'utf8',timeout:240000});

  const runDirs=(await fs.readdir(path.join(folder,'output'))).filter(n=>n.startsWith('run_'));
  assert.ok(runDirs.length>0,'Each successful run gets a unique output directory');
  const cfg=JSON.parse(await fs.readFile(path.join(folder,'output/run_settings.json'),'utf8'));
  assert.equal(cfg.projection,projection);
  if(name==='japan')assert.match(await fs.readFile(path.join(folder,'output/plotted_records.csv'),'utf8'),/New species/);
  for(const ext of ['png','pdf','svg'])assert.ok((await fs.stat(path.join(folder,'output/map.'+ext))).size>1000);
  await fs.copyFile(path.join(folder,'output/map.png'),path.join(folder,name+'.png'));console.log(name+' R integration passed');
  if(name==='baseline'){
   const stale=path.resolve('qa/stale-r-package');await fs.mkdir(stale,{recursive:true});await fs.writeFile(path.join(stale,'config.json'),'{}');
   execFileSync('Rscript',['-e','source('+JSON.stringify(file)+')'],{cwd:stale,encoding:'utf8',timeout:240000});
   assert.ok(!(await fs.readdir(stale)).includes('output'),'source must ignore another package in cwd');
  }
 }
}
