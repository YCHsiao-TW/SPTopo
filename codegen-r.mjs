import {editableSettings} from './codegen-editable.mjs?r=mixed-italics';
export function mapR(state,{width=3000}={}){
 const c=editableSettings(state,width);
 return String.raw`# SPTopo — editable geographic map, version 4
# Run install_packages.R once, then Rscript map.R.
# Set map bounds, projection and dimensions below. Edit other settings in config.json.
overrides <- list(
  bounds = c(${c.bounds.map(v=>Number(v.toFixed(6))).join(', ')}), # west,south,east,north; east<west crosses dateline
  projection = "${c.projection}", # mercator / equalEarth / robinson
  central_meridian = ${Number(c.central_meridian.toFixed(6))},
  output_width_cm = ${c.output_width_cm}, output_height_cm = ${c.output_height_cm},
  output_pixels = ${width}
)
# Set overrides <- list() to use config.json without overrides.

required <- c("sf", "terra", "ggplot2", "jsonlite", "png", "showtext", "sysfonts", "systemfonts")
missing <- required[!vapply(required, requireNamespace, logical(1), quietly=TRUE)]
if(length(missing)) stop("Run install_packages.R first. Missing: ", paste(missing, collapse=", "))
library(sf); library(terra); library(ggplot2)
sf_use_s2(FALSE)
# Always use the sourced script directory, even when the old working directory has a config.
source_paths <- unlist(lapply(sys.frames(),function(f) if(is.character(f$ofile)) f$ofile else NULL),use.names=FALSE)
args <- commandArgs(FALSE); cli_path <- sub("^--file=", "", args[grepl("^--file=",args)])
script <- if(length(source_paths)) tail(source_paths,1) else cli_path
if(length(script)) setwd(dirname(normalizePath(script[1],mustWork=TRUE)))
message("SPTopo editable R v4 | Package: ", normalizePath(getwd()))
if(!file.exists("config.json")) stop("Set the working directory to the extracted SPTopo package folder.")
cfg <- modifyList(jsonlite::fromJSON("config.json"), overrides)
# Unicode labels use verified font files. showtext draws glyph outlines on all devices.
# PDF/SVG text becomes paths; edit labels in this script/CSV and regenerate.
font_registry <- new.env(parent=emptyenv())
font_log <- character()
font_table <- systemfonts::system_fonts()
# sysfonts uses face zero in font collections: verify that same face, not a different index.
font_table <- font_table[font_table$index==0 & file.exists(font_table$path),,drop=FALSE]
preferred <- c("PingFang TC","Heiti TC","Microsoft JhengHei","Noto Sans CJK TC","Noto Sans TC","Source Han Sans TC","Arial Unicode MS")
rank <- match(font_table$family,preferred);rank[is.na(rank)]<-length(preferred)+1
system_paths <- unique(font_table$path[order(rank)])
bundled_paths <- list.files(system.file(package="showtextdb"),pattern="wqy.*[.](ttc|ttf|otf)$",recursive=TRUE,full.names=TRUE,ignore.case=TRUE)
font_for <- function(label,fallback="sans",face="plain"){
 text<-enc2utf8(paste(label,collapse=""))
 if(all(utf8ToInt(text)<=127L))return(fallback)
 chars<-unique(strsplit(text,"",fixed=TRUE)[[1]])
 chars<-chars[!grepl("[[:space:]]",chars)]
 custom<-cfg$font_file
 if(is.null(custom))custom<-""
 if(nzchar(custom)&&!file.exists(custom))stop("font_file does not exist: ",custom)
 family<-switch(fallback,serif="Serif",mono="Mono","Sans")
 style<-switch(face,bold="Bold",italic="Italic","bold.italic"="BoldItalic","Regular")
 packaged<-file.path("fonts",paste0("Liberation",family,"-",style,".ttf"))
 paths<-unique(c(if(nzchar(custom))custom,packaged,system_paths,bundled_paths))
 for(path in paths){
 if(!file.exists(path))next
 covered<-tryCatch(all(systemfonts::glyph_info(chars,path=path,index=0)$index>0),error=function(e)FALSE)
 if(!covered)next
 if(!exists(path,envir=font_registry,inherits=FALSE)){
 alias<-paste0("sptopo_unicode_",length(ls(font_registry))+1)
 registered<-tryCatch({sysfonts::font_add(alias,regular=path);TRUE},error=function(e)FALSE)
 if(!registered)next
 assign(path,alias,envir=font_registry)
 font_log<<-unique(c(font_log,paste(alias,normalizePath(path),sep=" = ")))
 message("Unicode font: ",basename(path))
 }
 return(get(path,envir=font_registry,inherits=FALSE))
 }
 stop("No font covers this label. Set overrides$font_file to a font with the required glyphs, then rerun. Label: ",text)
}

read_utf8_csv <- function(path){
 lines<-readLines(path,encoding="UTF-8",warn=FALSE)
 if(any(!validUTF8(lines)))
   stop("Invalid UTF-8 in ",path,". Save it as a UTF-8 CSV and rerun.")
 if(length(lines))lines[1L]<-sub("^\ufeff","",lines[1L])
 connection<-textConnection(lines,encoding="UTF-8")
 on.exit(close(connection))
 utils::read.csv(connection,encoding="UTF-8",colClasses="character",check.names=FALSE)
}

layout_spec<-jsonlite::fromJSON("layout.json",simplifyVector=FALSE)
notes <- jsonlite::fromJSON("export_notes.json")
if(length(notes)) warning(paste(notes, collapse="\n"), call.=FALSE)
stopifnot(length(cfg$bounds)==4, all(is.finite(cfg$bounds)), cfg$bounds[2]<cfg$bounds[4], cfg$bounds[2]>=-85, cfg$bounds[4]<=85,
          cfg$output_pixels>=100, cfg$output_pixels<=10000, cfg$output_width_cm>0, cfg$output_height_cm>0,
          cfg$digits>=0, cfg$digits<=10, cfg$contour_interval>0, cfg$point_size>0)
b <- as.numeric(cfg$bounds); if(b[3]<b[1]) b[3] <- b[3]+360
if(b[3]-b[1]<=0 || b[3]-b[1]>360) stop("Longitude span must be >0 and <=360 degrees.")
crs_out <- switch(cfg$projection, mercator=sprintf("+proj=merc +lon_0=%s +a=6378137 +b=6378137 +units=m",cfg$central_meridian),
 equalEarth=sprintf("+proj=eqearth +lon_0=%s +datum=WGS84 +units=m",cfg$central_meridian),
 robinson=sprintf("+proj=robin +lon_0=%s +datum=WGS84 +units=m",cfg$central_meridian), stop("Unknown projection"))
# Split/crop in geographic coordinates BEFORE reprojection; preserve dateline views.
make_box <- function(w,e,s,n) {
 x<-seq(w,e,length.out=181);y<-seq(s,n,length.out=91)
 ring<-rbind(cbind(x,s),cbind(e,y[-1]),cbind(rev(x)[-1],n),cbind(w,rev(y)[-1]))
 st_sfc(st_polygon(list(ring)),crs=4326)
}
w <- ((b[1]+180)%%360)-180; e <- w+b[3]-b[1]
area <- if(e>180) c(make_box(w,180,b[2],b[4]),make_box(-180,e-360,b[2],b[4])) else make_box(w,e,b[2],b[4])
area <- st_union(area)
project_layer <- function(x) {
 source_polygon<-any(st_geometry_type(x)%in%c("POLYGON","MULTIPOLYGON"))
 x <- st_make_valid(x)
 x <- suppressWarnings(st_intersection(x,area))
 if(!length(st_geometry(x)) || all(st_is_empty(x))) return(st_transform(x,crs_out))
 x<-x[!st_is_empty(x),]
 if(any(st_geometry_type(x)=="GEOMETRYCOLLECTION"))x<-suppressWarnings(st_collection_extract(x,if(source_polygon)"POLYGON" else "LINESTRING"))
 if(!nrow(x))return(st_transform(x,crs_out))
 x <- st_break_antimeridian(x, lon_0=cfg$central_meridian)
 st_transform(x,crs_out)
}
read_layer <- function(file) project_layer(st_read(file,quiet=TRUE))
# Densified boundary supplies reliable projected plot limits.
edge <- st_boundary(area)
box <- st_bbox(st_transform(edge,crs_out)); xr <- as.numeric(box[c(1,3)]); yr <- as.numeric(box[c(2,4)])
# Land polygons mask terrain; separate coast lines exclude artificial tile edges.
coast_credit <- NULL
coast_files <- character()
load_coast <- function() {
  folder <- "coast-detail"
  index <- jsonlite::fromJSON(file.path(folder,"index.json"),simplifyVector=FALSE)
  initial <- jsonlite::fromJSON(file.path(folder,"selection.json"))
  same_view <- identical(cfg$projection,initial$projection) && all(abs(cfg$bounds-initial$bounds)<1e-6)
  if(same_view) {
    files <- as.character(initial$files)
  } else {
    overlap <- function(tile) {
      q <- unlist(tile$bbox)
      q[2]<b[4] && q[4]>b[2] && floor((w-q[3])/360)+1<=ceiling((e-q[1])/360)-1
    }
    files <- vapply(Filter(overlap,index$tiles),function(tile) tile$file,character(1))
    merc_y <- function(lat) (1-asinh(tan(lat*pi/180))/pi)/2
    plot_height <- jsonlite::fromJSON("layout.json")$plot$h
    scale <- min(cfg$map_width/((e-w)/360),plot_height/(merc_y(b[2])-merc_y(b[4])))
    if(cfg$projection!="mercator" || scale<256*2^5 || length(files)>24) files <- index$overview
  }
  targets <- file.path(folder,paste0(files,".geojson"))
  if(!length(files)) targets <- character()
  missing <- which(!file.exists(targets))
  if(length(missing)){
    if(!isTRUE(cfg$allow_download)) stop("Coast tiles for this extent are missing. Enable allow_download or export this extent from SPTopo.")
    remote <- jsonlite::fromJSON(paste0(initial$baseUrl,"index.json"),simplifyVector=FALSE)
    if(!identical(remote$source,index$source)) stop("SPTopo's coastline data have changed. Export a fresh R package from the website.")
    for(i in missing){
      dir.create(dirname(targets[i]),recursive=TRUE,showWarnings=FALSE)
      tmp <- tempfile(tmpdir=dirname(targets[i]))
      tryCatch({
        code <- utils::download.file(paste0(initial$baseUrl,files[i]),tmp,mode="wb",quiet=TRUE)
        if(code!=0 || !identical(jsonlite::fromJSON(tmp,simplifyVector=FALSE)$type,"FeatureCollection") || !file.rename(tmp,targets[i]))
          stop("Could not cache coastline tile: ",files[i])
      },finally=unlink(tmp))
    }
  }
  layers <- lapply(targets,st_read,quiet=TRUE)
  read_kind <- function(kind){
    parts <- lapply(layers,function(layer) st_sf(geometry=st_geometry(layer[layer$kind %in% kind,])))
    parts <- Filter(function(part) nrow(part)>0,parts)
    if(!length(parts)) return(st_sf(geometry=st_sfc(crs=crs_out)))
    projected_parts <- project_layer(do.call(rbind,parts))
    expected <- if(kind=="land") c("POLYGON","MULTIPOLYGON") else c("LINESTRING","MULTILINESTRING")
    projected_parts[st_geometry_type(projected_parts) %in% expected,]
  }
  list(land=read_kind("land"),line=read_kind("coast"),files=files,
       credit=paste(index$source$attribution,index$source$copyright,sep=" · "))
}
if(isTRUE(cfg$coast_detail)){
  coast <- load_coast()
  land <- coast$land; shore <- coast$line; coast_files <- coast$files; coast_credit <- coast$credit
} else {
  land <- read_layer("land.geojson"); shore <- land
}
countries <- read_layer("countries.geojson")
p <- ggplot()+geom_sf(data=land,fill="#e9f7e4",colour=NA)

# Raw Terrain Tiles -> numeric raster. Cache can be extended without the website.
load_dem <- function() {
 z <- max(0,min(12,as.integer(cfg$dem_zoom)))
 tile_keys <- function(z) {
  n <- 2^z; yy <- function(lat) (1-asinh(tan(lat*pi/180))/pi)/2*n
  xs <- seq(floor((w+180)/360*n),ceiling((e+180)/360*n)-1)
  ys <- seq(max(0,floor(yy(b[4]))),min(n-1,ceiling(yy(b[2]))-1))
  g <- expand.grid(x=unique(xs%%n),y=ys); transform(g,z=z)
 }
 keys <- tile_keys(z)
 while(nrow(keys)>cfg$max_tiles && z>0){z<-z-1;keys<-tile_keys(z)}
 if(z!=cfg$dem_zoom) message("DEM zoom reduced to ",z," to stay within max_tiles; change that setting if needed.")
 dir.create("dem_cache",showWarnings=FALSE)
 tiles <- lapply(seq_len(nrow(keys)),function(i){
  k <- keys[i,]; stem <- sprintf("dem_%d_%d_%d",k$z,k$x,k$y)
  asc <- paste0(stem,".asc"); tif <- file.path("dem_cache",paste0(stem,".tif"))
  if(file.exists(tif)) return(rast(tif))
  if(file.exists(asc)){r<-rast(asc);crs(r)<-"EPSG:3857";return(r)}
  if(!isTRUE(cfg$allow_download)) stop("Missing DEM tile ",stem,". Set allow_download=TRUE, provide the tile, or turn off terrain, bathymetry and land_contours.")
  url <- sprintf("https://elevation-tiles-prod.s3.amazonaws.com/terrarium/%d/%d/%d.png",k$z,k$x,k$y)
  temp <- tempfile(fileext=".png");on.exit(unlink(temp),add=TRUE)
  tryCatch(download.file(url,temp,mode="wb",quiet=TRUE),error=function(err) stop("Cannot download DEM: ",url," — ",conditionMessage(err)))
  rgb <- png::readPNG(temp)
  v <- round(rgb[,,1]*255)*256+round(rgb[,,2]*255)+round(rgb[,,3]*255)/256-32768
  span<-40075016.68557849/2^k$z
  r<-rast(nrows=256,ncols=256,xmin=-20037508.342789244+k$x*span,xmax=-20037508.342789244+(k$x+1)*span,
          ymin=20037508.342789244-(k$y+1)*span,ymax=20037508.342789244-k$y*span,crs="EPSG:3857")
  values(r)<-as.vector(t(v));writeRaster(r,tif,overwrite=TRUE);r
 })
 # Each tile is projected directly to the same target grid, avoiding a huge dateline mosaic.
 cols<-max(100,round(cfg$output_pixels*.9));rows<-max(80,round(cols*diff(yr)/diff(xr)))
 limit<-if(is.null(cfg$raster_max_cells))16000000 else cfg$raster_max_cells
 if(cols*rows>limit){factor<-sqrt(limit/(cols*rows));cols<-floor(cols*factor);rows<-floor(rows*factor);message("Raster limited to ",cols," x ",rows," cells; increase raster_max_cells if needed.")}
 message("DEM target grid: ",cols," x ",rows,"; source zoom: ",z)
 target<-rast(ncols=cols,nrows=rows,xmin=xr[1],xmax=xr[2],ymin=yr[1],ymax=yr[2],crs=crs_out)
 out<-target;values(out)<-NA_real_
 if(e<=180){
  source<-if(length(tiles)==1)tiles[[1]] else do.call(terra::merge,tiles)
  out<-project(source,target,method="bilinear")
 }else for(r in tiles) out<-cover(out,project(r,target,method="bilinear"))
 out
}
dem <- NULL
if(cfg$terrain || cfg$bathymetry || cfg$land_contours){
 dem<-load_dem(); landmask<-if(nrow(land)) rasterize(vect(land),dem,field=1,background=NA) else init(dem,NA_real_)
 if(cfg$terrain || cfg$bathymetry){
  display<-dem
  if(!cfg$bathymetry) display<-mask(display,landmask)
  if(!cfg$terrain) display<-mask(display,landmask,inverse=TRUE)
  rd<-as.data.frame(display,xy=TRUE,na.rm=TRUE);names(rd)<-c("x","y","elevation")
  palettes<-jsonlite::fromJSON("palettes.json",simplifyVector=FALSE)
  stops<-if(cfg$terrain) palettes$elevation else list()
  if(cfg$bathymetry) stops<-c(lapply(rev(palettes$depth),function(a) list(-a[[1]],a[[2]])),stops)
  zz<-vapply(stops,function(a)as.numeric(a[[1]]),numeric(1));cc<-vapply(stops,function(a)a[[2]],character(1));keep<-!duplicated(zz,fromLast=TRUE);zz<-zz[keep];cc<-cc[keep]
  p<-p+geom_raster(data=rd,aes(x=x,y=y,fill=elevation))+scale_fill_gradientn(colours=cc,values=(zz-min(zz))/diff(range(zz)),limits=range(zz),oob=scales::squish,breaks=if(cfg$bathymetry)seq(ceiling(min(zz)/1000)*1000,max(zz),by=1000) else seq(0,max(zz),by=1000),name=cfg$figure_labels$elevation,guide=if(cfg$legend)guide_colourbar(barheight=grid::unit(min(cfg$output_height_cm*.45,if(cfg$bathymetry)7 else 5),"cm"),theme=theme(legend.text=element_text(face="plain",size=8)),order=2) else "none")
 }
 if(cfg$hillshade && cfg$terrain){
  slope<-terrain(dem,"slope",unit="radians");aspect<-terrain(dem,"aspect",unit="radians")
  sh<-shade(slope,aspect,angle=cfg$sun_angle,direction=cfg$sun_direction);sh<-mask(sh,landmask)
  dd<-as.data.frame(sh,xy=TRUE,na.rm=TRUE);names(dd)<-c("x","y","shade")
  p<-p+geom_raster(data=dd,aes(x=x,y=y,alpha=1-shade),fill="black",show.legend=FALSE)+scale_alpha_continuous(range=c(0,cfg$shade_strength),guide="none")
 }
 if(cfg$land_contours){
  heights<-mask(dem,landmask); mx<-global(heights,"max",na.rm=TRUE)[1,1]
  if(is.finite(mx)&&mx>=cfg$contour_interval){contours<-as.contour(heights,levels=seq(cfg$contour_interval,mx,by=cfg$contour_interval));p<-p+geom_sf(data=st_as_sf(contours),colour="#777777",linewidth=.15)}
 }
}
p<-p+geom_sf(data=shore,fill=NA,colour="#657c54",linewidth=.18)
for(entry in list(c("countries","country-borders.geojson"),c("provinces","provinces.geojson"))){
 if(!isTRUE(cfg[[entry[1]]])) next
 p<-p+geom_sf(data=read_layer(entry[2]),fill=NA,colour="#687560",linewidth=.15)
}
freshwater <- NULL
freshwater_credit <- NULL
if(isTRUE(cfg$freshwater)){
 if(!file.exists("freshwater-source.json") || !file.exists("freshwater.geojson"))
  stop("Freshwater files are missing. Export a new SPTopo ZIP for this view.")
 freshwater <- jsonlite::fromJSON("freshwater-source.json",simplifyVector=FALSE)
 if(max(abs(unlist(freshwater$bounds)-cfg$bounds))>2e-6 ||
    !identical(freshwater$projection,cfg$projection) ||
    abs(freshwater$central_meridian-cfg$central_meridian)>2e-6)
  stop("The freshwater layer is fixed to the exported view. Export a new SPTopo ZIP for a different extent or projection.")
 freshwater_credit <- paste(freshwater$source$attribution,freshwater$source$copyright,sep=" · ")
 if(freshwater$features>0)water_features<-st_read("freshwater.geojson",quiet=TRUE)
 if(freshwater$features>0)for(style in c("seasonal-area","area","seasonal-line","stream","river","main")){
  ink <- freshwater$styles[[style]]
  layer <- water_features[water_features$style==style,]
  if(!nrow(layer))next
  layer <- project_layer(layer)
  target <- if(is.null(ink$fill))"LINESTRING" else "POLYGON"
  accepted <- if(is.null(ink$fill))c("LINESTRING","MULTILINESTRING") else c("POLYGON","MULTIPOLYGON")
  layer <- layer[st_geometry_type(layer) %in% accepted,]
  if(!nrow(layer))next
  layer <- suppressWarnings(st_cast(layer,target))
  layer <- layer[!st_is_empty(layer),]
  if(nrow(layer)){
   if(is.null(ink$fill))p<-p+geom_sf(data=layer,colour=ink$stroke,linewidth=ink$width*cfg$output_width_cm/layout_spec$page$width*10)
   else p<-p+geom_sf(data=layer,fill=ink$fill,colour=NA)
  }
 }
}
if(cfg$country_labels && nrow(countries)){
 disputes<-st_geometry(read_layer("disputes.geojson"))
 has_disputes<-length(disputes)>0L && any(!st_is_empty(disputes))
 if(has_disputes) disputes<-st_union(disputes)
 nm<-if(cfg$language=="zh-Hant")countries$name_zh_hant else if(cfg$language=="zh-Hans")countries$name_zh else countries$name
 label_rows<-list();occupied<-list()
 for(name in unique(nm)){
  safe<-st_union(st_geometry(countries)[which(nm==name)])
  if(has_disputes) safe<-st_difference(safe,disputes)
  parts<-suppressWarnings(st_cast(st_collection_extract(safe,"POLYGON"),"POLYGON"))
  if(!length(parts)||all(st_is_empty(parts)))next
  parts<-parts[order(as.numeric(st_area(parts)),decreasing=TRUE)]
  for(j in seq_along(parts)){
   anchor<-suppressWarnings(st_point_on_surface(parts[j]));xy<-st_coordinates(anchor)[1,]
   hw<-nchar(name,type="width")*1.9*diff(xr)/(cfg$output_width_cm*10*.65)/2
   hh<-4*diff(yr)/(cfg$output_height_cm*10*.8)/2
   if(xy[1]-hw<xr[1]||xy[1]+hw>xr[2]||xy[2]-hh<yr[1]||xy[2]+hh>yr[2])next
   rect<-st_as_sfc(st_bbox(c(xmin=unname(xy[1]-hw),ymin=unname(xy[2]-hh),xmax=unname(xy[1]+hw),ymax=unname(xy[2]+hh)),crs=st_crs(crs_out)))
   if(has_disputes && lengths(st_intersects(rect,disputes))>0)next
   if(length(occupied)&&any(vapply(occupied,function(r)lengths(st_intersects(rect,r))>0,logical(1))))next
   occupied[[length(occupied)+1]]<-rect;label_rows[[length(label_rows)+1]]<-st_sf(label=name,geometry=anchor);break
  }
 }
 if(length(label_rows)){
   labels<-do.call(rbind,label_rows)
   labels$label_font<-vapply(labels$label,font_for,character(1))
   p<-p+geom_sf_text(data=labels,aes(label=label,family=label_font),size=3,colour="#58615b",check_overlap=TRUE)
 }
}

# Re-read WGS84 records each time; no coordinates are baked into the script.
occ<-read_utf8_csv("occurrences.csv")
if(!all(c("longitude","latitude","species")%in%names(occ))) stop("occurrences.csv needs longitude, latitude, species columns")
occ$longitude<-suppressWarnings(as.numeric(occ$longitude));occ$latitude<-suppressWarnings(as.numeric(occ$latitude))
ok<-is.finite(occ$longitude)&is.finite(occ$latitude)&abs(occ$longitude)<=180&abs(occ$latitude)<=85&!is.na(occ$species)&nzchar(occ$species)
if(any(!ok)) warning(sum(!ok)," invalid records excluded")
occ<-occ[ok,];if(!nrow(occ)) stop("No valid occurrences")
occ$longitude<-round(occ$longitude,cfg$digits);occ$latitude<-round(occ$latitude,cfg$digits)
counts<-aggregate(rep(1,nrow(occ)),occ[c("longitude","latitude","species")],sum);names(counts)[4]<-"count"
if(cfg$pie_mode=="presence") counts$count<-1
sites<-st_as_sf(counts,coords=c("longitude","latitude"),crs=4326,remove=FALSE)
sites<-sites[lengths(st_intersects(sites,area))>0,];sites<-st_transform(sites,crs_out)
taxa<-read_utf8_csv("taxa.csv")
new<-setdiff(unique(occ$species),taxa$taxon)
if(length(new))taxa<-rbind(taxa,data.frame(taxon=new,color=grDevices::hcl.colors(length(new),"Dark 3"),shape="circle",display_name=new))
if(anyDuplicated(taxa$taxon))stop("taxa.csv contains duplicate taxon keys")
taxa<-taxa[taxa$taxon %in% sites$species,,drop=FALSE]
shapes<-jsonlite::fromJSON("shapes.json",simplifyVector=FALSE)
# Marker radius in projected units scales with the map and requested physical width.
radius<-diff(xr)*cfg$point_size/cfg$map_width
marker_data<-list();idx<-0
if(nrow(sites)){
 xy<-st_coordinates(sites);keys<-paste(sites$longitude,sites$latitude,sep=",")
 for(key in unique(keys)){
  ids<-which(keys==key);ids<-ids[order(match(sites$species[ids],taxa$taxon))];cum<--pi/2;total<-sum(sites$count[ids]);rsite<-radius+if(isTRUE(cfg$auto_size))diff(xr)/cfg$map_width*max(0,length(ids)-1)*2 else 0
  for(i in ids){idx<-idx+1;taxon<-sites$species[i];shape<-taxa$shape[match(taxon,taxa$taxon)]
   if(cfg$pies && length(ids)>1){a<-seq(cum,cum+sites$count[i]/total*2*pi,length.out=40);rings<-list(rbind(c(0,0),cbind(cos(a),sin(a)),c(0,0)));cum<-tail(a,1)
   }else if(shape=="circle" || is.null(shapes[[shape]])){a<-seq(0,2*pi,length.out=65);rings<-list(cbind(cos(a),sin(a)))
   }else rings<-lapply(shapes[[shape]],function(r)matrix(as.numeric(unlist(r)),ncol=2,byrow=TRUE))
   for(j in seq_along(rings)){ring<-rings[[j]];marker_data[[length(marker_data)+1]]<-data.frame(x=xy[i,1]+ring[,1]*rsite,y=xy[i,2]-ring[,2]*rsite,taxon=taxon,id=paste(idx,j,sep="_"))}
  }
 }
}
# Literal hex colors keep point colors independent of the elevation color scale.
if(length(marker_data)){
 md<-do.call(rbind,marker_data)
 p<-p+geom_polygon(data=md,aes(x=x,y=y,group=id),fill=NA,colour="white",linewidth=.9,show.legend=FALSE)
 for(taxon in unique(md$taxon))p<-p+geom_polygon(data=md[md$taxon==taxon,],aes(x=x,y=y,group=id,colour=taxon),fill=taxa$color[match(taxon,taxa$taxon)],linewidth=.3,key_glyph=function(data,params,size){
 shape<-taxa$shape[match(data$fill,taxa$color)];gp<-grid::gpar(fill=data$fill,col="#26372b",lwd=.7)
 if(is.na(shape)||shape=="circle"||is.null(shapes[[shape]]))return(grid::circleGrob(r=.3,gp=gp))
 grobs<-lapply(shapes[[shape]],function(r){q<-matrix(as.numeric(unlist(r)),ncol=2,byrow=TRUE);grid::polygonGrob(x=.5+.3*q[,1],y=.5-.3*q[,2],gp=gp)})
 do.call(grid::grobTree,grobs)
 })
 p<-p+scale_colour_manual(values=setNames(rep("#26372b",nrow(taxa)),taxa$taxon),breaks=taxa$taxon,labels=taxa$display_name,name=cfg$figure_labels$taxa,guide=if(cfg$legend)guide_legend(override.aes=list(fill=taxa$color),order=1) else "none")
}
if(cfg$site_ids && nrow(sites)){ids<-!duplicated(paste(sites$longitude,sites$latitude));ss<-sites[ids,];ss$site_id<-seq_len(nrow(ss));p<-p+geom_sf_text(data=ss,aes(label=site_id),nudge_y=radius*1.6,size=2.8)}
if(cfg$north_arrow){
 u<-diff(xr)/cfg$map_width;cx<-xr[2]-31*u;cy<-yr[2]-65*u
 north_vector<-function(anchor){
  origin<-suppressWarnings(st_transform(st_sfc(st_point(anchor),crs=crs_out),4326))
  if(st_is_empty(origin)) return(NULL)
  ll<-as.numeric(st_coordinates(origin)[1L,])
  if(any(!is.finite(ll)) || abs(ll[2])>85) return(NULL)
  pair<-st_sfc(st_point(ll),st_point(c(ll[1],ll[2]+.05)),crs=4326)
  pair<-suppressWarnings(st_transform(pair,crs_out))
  if(any(st_is_empty(pair))) return(NULL)
  xy<-st_coordinates(pair)
  # An inverse outside a curved map can wrap longitude; check the round trip.
  if(any(!is.finite(xy)) || max(abs(xy[1L,]-anchor))>max(1,u/20)) return(NULL)
  direction<-xy[2L,]-xy[1L,]
  if(all(direction==0)) return(NULL)
  direction
 }
 nn<-north_vector(c(cx,cy))
 if(is.null(nn)) nn<-north_vector(c(mean(xr),mean(yr)))
 theta<-if(is.null(nn)) 0 else atan2(nn[2],nn[1])-pi/2
 arrow<-function(a){x<-a[,1]*cos(theta)-a[,2]*sin(theta);y<-a[,1]*sin(theta)+a[,2]*cos(theta);data.frame(x=cx+x*u,y=cy+y*u)}
 p<-p+geom_polygon(data=arrow(rbind(c(0,0),c(-8,-32),c(0,-25),c(8,-32))),aes(x,y),fill="white",colour="#344b30",linewidth=.3)+geom_polygon(data=arrow(rbind(c(0,0),c(-8,-32),c(0,-25))),aes(x,y),fill="#344b30")+annotate("text",x=cx,y=cy+15*u,label="N",size=4)
}
if(cfg$scale_bar){
 center<-st_transform(st_sfc(st_point(c(mean(xr),mean(yr))),crs=crs_out),4326);ll<-st_coordinates(center)[1,]
 pair<-st_sfc(st_point(ll),st_point(c(ll[1]+.01,ll[2])),crs=4326)
 meters<-6371008.8*acos(min(1,sin(ll[2]*pi/180)^2+cos(ll[2]*pi/180)^2*cos(.01*pi/180)));pp<-st_coordinates(st_transform(pair,crs_out));units<-sqrt(sum((pp[2,]-pp[1,])^2))
 target<-diff(xr)*.19/units*meters; power<-10^floor(log10(target));nice<-power*if(target/power>=5)5 else if(target/power>=2)2 else 1;len<-nice/meters*units
 p<-p+annotate("segment",x=xr[1]+diff(xr)*.05,xend=xr[1]+diff(xr)*.05+len,y=yr[1]+diff(yr)*.05,yend=yr[1]+diff(yr)*.05)+annotate("text",x=xr[1]+diff(xr)*.05+len/2,y=yr[1]+diff(yr)*.08,label=paste(nice/1000,"km"),size=2.5)
}
p<-p+coord_sf(crs=crs_out,xlim=xr,ylim=yr,expand=FALSE,datum=if(isTRUE(cfg$frame)||cfg$grid)st_crs(4326) else NA)+labs(x=NULL,y=NULL)+theme_minimal()+theme(panel.grid=if(cfg$grid)element_line(colour="#dddddd") else element_blank(),panel.background=element_rect(fill=if(cfg$ocean||cfg$bathymetry)"#e6f4f7" else "white",colour=NA),panel.border=if(cfg$frame)element_rect(colour="#65745f",fill=NA,linewidth=.5) else element_blank(),legend.text=element_text(face=if(cfg$italic)"italic" else "plain"),legend.key.height=grid::unit(.6,"cm"))
if(cfg$demo)p<-p+labs(caption="DEMONSTRATION DATA — synthetic records")
# Use the website's page coordinates for independent legends and map margins.
W<-layout_spec$page$width; H<-layout_spec$page$height
pt<-cfg$output_width_cm/2.54*72/W
p<-p+theme(legend.position="none",plot.margin=margin(0,0,0,0),
 axis.text=element_text(size=11*pt,colour="#78826d"))
if(cfg$projection=="mercator"){
 ticks<-function(lo,hi){raw<-(hi-lo)/5;power<-10^floor(log10(raw));v<-raw/power;step<-power*if(v<=1)1 else if(v<=2)2 else if(v<=5)5 else 10;seq(ceiling(lo/step)*step,floor(hi/step)*step,by=step)}
 degree<-function(x)paste0(format(x,trim=TRUE,scientific=FALSE),"°")
 p<-p+scale_x_continuous(breaks=ticks(b[1],b[3]),labels=degree)+scale_y_continuous(breaks=ticks(b[2],b[4]),labels=degree)
}
palettes<-jsonlite::fromJSON("palettes.json",simplifyVector=FALSE)
render_page<-function(){
gt<-ggplotGrob(p); panel<-gt$layout[gt$layout$name=="panel",]
gt$widths<-grid::unit(rep(0,length(gt$widths)),"pt");gt$widths[panel$l]<-grid::unit(1,"null")
gt$heights<-grid::unit(rep(0,length(gt$heights)),"pt");gt$heights[panel$t]<-grid::unit(1,"null");gt$respect<-FALSE
 grid::grid.newpage(); box<-layout_spec$plot
 # Fit the projected extent without stretching when the user changes bounds or projection.
 ratio<-diff(xr)/diff(yr); physical_ratio<-cfg$output_width_cm/cfg$output_height_cm
 bw<-box$w;bh<-box$h;wanted<-ratio*W/H/physical_ratio
 if(bw/bh>wanted)bw<-bh*wanted else bh<-bw/wanted
 bx<-box$x+(box$w-bw)/2;by<-box$y+(box$h-bh)/2
 grid::pushViewport(grid::viewport(x=bx/W,y=1-by/H,width=bw/W,height=bh/H,just=c("left","top")))
 grid::grid.draw(gt);grid::popViewport()
 font_face<-function(bold,italic)if(isTRUE(bold)&&isTRUE(italic))"bold.italic" else if(isTRUE(bold))"bold" else if(isTRUE(italic))"italic" else "plain"
 text_at<-function(label,x,y,size=10,family="sans",face="plain",color="#4c5b43",max_width=W-x-4,runs=NULL){
  parts<-label
  faces<-face
  if(length(runs)){
   text<-vapply(runs,function(run)run$text,character(1))
   if(identical(paste0(text,collapse=""),label)){
    parts<-text
    faces<-vapply(runs,function(run){
     if(is.null(run$italic))return(face)
     font_face(face %in% c("bold","bold.italic"),run$italic)
    },character(1))
   }
  }
  grobs<-Map(function(part,part_face){
   resolved<-font_for(part,family,part_face)
   gp<-grid::gpar(fontsize=size*pt,fontfamily=resolved,fontface=if(identical(resolved,family))part_face else "plain",col=color)
   grid::textGrob(part,y=1-y/H,just=c("left","bottom"),gp=gp)
  },parts,faces)
  widths<-vapply(grobs,function(g)grid::convertWidth(grid::grobWidth(g),"cm",valueOnly=TRUE),numeric(1))
  available<-max_width/W*cfg$output_width_cm
  scale<-if(available>0&&sum(widths)>available) available/sum(widths) else 1
  cursor<-x/W*cfg$output_width_cm
  for(i in seq_along(grobs)){
   g<-grobs[[i]]
   g$x<-grid::unit(cursor,"cm")
   g$gp$fontsize<-size*pt*scale
   grid::grid.draw(g)
   cursor<-cursor+widths[i]*scale
  }
 }
 if(cfg$demo)text_at("DEMONSTRATION DATA — synthetic records",box$x,H-10,9)
 credit<-if(is.null(coast_credit))freshwater_credit else coast_credit
 if(!is.null(credit))grid::grid.text(credit,x=.985,y=grid::unit(5,"pt"),just=c("right","bottom"),gp=grid::gpar(fontsize=8*pt,col="#33452e"))
 if(!cfg$legend)return(invisible(NULL))
 for(block in layout_spec$legends){
 kind<-block$kind;st<-block$style;x<-block$x;y<-block$y
 family<-switch(st$family,serif="serif",mono="mono","sans")
 title<-st$title
 if(!nzchar(title)){
  label<-cfg$figure_labels[[kind]]
  title<-if(is.null(label)) kind else label
 }
 if(!kind%in%c("taxa","elevation","depth","water"))next
 if(kind=="water"&&(is.null(freshwater)||isFALSE(cfg$legend_water)))next
 if(kind=="taxa"&&isFALSE(cfg$legend_species) || kind=="elevation"&&(!cfg$terrain||isFALSE(cfg$legend_elevation)) || kind=="depth"&&(!cfg$bathymetry||isFALSE(cfg$legend_depth)))next
 if(isTRUE(st$background)||isTRUE(st$border))grid::grid.rect(x=(x+block$w/2)/W,y=1-(y+block$h/2)/H,width=block$w/W,height=block$h/H,gp=grid::gpar(fill=if(st$background)"white" else NA,col=if(st$border)st$color else NA))
 text_at(title,x+10,y+max(24,st$titleFont+6),st$titleFont,family,font_face(st$titleBold,st$titleItalic),st$color)
 if(kind=="taxa"){
 rows<-ceiling(nrow(taxa)/block$columns);gap<-min(block$gap,(H-y-block$head-12)/max(1,rows))
 if(nrow(taxa))for(i in seq_len(nrow(taxa))){
 col<-floor((i-1)/rows);row<-(i-1)%%rows;cx<-x+15+col*200;cy<-y+block$head+row*gap-4;r<-min(st$symbol,gap*.3)
 gp<-grid::gpar(fill=taxa$color[i],col="#26372b",lwd=.7*pt)
 shape<-taxa$shape[i]
 if(shape=="circle"||is.null(shapes[[shape]]))grid::grid.circle(x=cx/W,y=1-cy/H,r=grid::unit(r/W*cfg$output_width_cm,"cm"),gp=gp) else for(ring in shapes[[shape]]){
 q<-matrix(as.numeric(unlist(ring)),ncol=2,byrow=TRUE);grid::grid.polygon(x=(cx+q[,1]*r)/W,y=1-(cy+q[,2]*r)/H,gp=gp)
 }
 text_at(taxa$display_name[i],cx+max(19,r+12),cy+4,min(st$font,gap*.65),family,font_face(st$bold,st$italic),st$color,max_width=min(170,W-cx-25),runs=st$nameRuns[[taxa$taxon[i]]])
 }
 }else if(kind=="water"){
 cy<-y+max(43,st$titleFont+st$font+12)
 cx<-x+10+block$waterColumn
 grid::grid.segments((x+10)/W,1-(cy-4)/H,(x+24)/W,1-(cy-4)/H,gp=grid::gpar(col=freshwater$styles$main$stroke,lwd=1.1*pt))
 text_at(cfg$figure_labels$water_rivers,x+31,cy,st$font,family,"plain",st$color)
 grid::grid.rect((cx+6.5)/W,1-(cy-6.5)/H,13/W,9/H,gp=grid::gpar(fill=freshwater$styles$area$fill,col=NA))
 text_at(cfg$figure_labels$water_lakes,cx+20,cy,st$font,family,"plain",st$color)
 }else{
 ramp<-palettes[[kind]];z<-vapply(ramp,function(a)as.numeric(a[[1]]),numeric(1));cc<-vapply(ramp,function(a)a[[2]],character(1));ord<-order(z);z<-z[ord];cc<-cc[ord]
 vals<-seq(min(z),max(z),length.out=512);rgb<-grDevices::col2rgb(cc)
 colors<-grDevices::rgb(approx(z,rgb[1,],vals)$y,approx(z,rgb[2,],vals)$y,approx(z,rgb[3,],vals)$y,maxColorValue=255)
 if(kind=="elevation")colors<-rev(colors)
 top<-y+block$barTop;height<-block$barHeight
 grid::grid.raster(matrix(colors,ncol=1),x=(x+16)/W,y=1-(top+height/2)/H,width=12/W,height=height/H,interpolate=TRUE)
 step<-1000*max(1,ceiling((max(z)-min(z))/1000*st$font*1.3/height));values<-seq(0,max(z),by=step)
 for(v in values){f<-(v-min(z))/diff(range(z));if(kind=="elevation")f<-1-f;text_at(v,x+34,top+f*height+4,st$font,family,font_face(st$bold,st$italic),st$color)}
 }
 }
}
dir.create("output",showWarnings=FALSE)
run_dir<-tempfile(pattern=paste0("run_",format(Sys.time(),"%Y%m%d_%H%M%S"),"_"),tmpdir="output")
dir.create(run_dir)
for(format in c("png","pdf","svg")){
 file<-file.path(run_dir,paste0("map.",format))
 if(format=="png")grDevices::png(file,width=cfg$output_pixels,height=round(cfg$output_pixels*cfg$output_height_cm/cfg$output_width_cm),res=cfg$output_pixels/(cfg$output_width_cm/2.54))
 if(format=="pdf")grDevices::cairo_pdf(file,width=cfg$output_width_cm/2.54,height=cfg$output_height_cm/2.54)
 if(format=="svg")grDevices::svg(file,width=cfg$output_width_cm/2.54,height=cfg$output_height_cm/2.54)
 showtext::showtext_opts(dpi=if(format=="png")cfg$output_pixels/(cfg$output_width_cm/2.54) else 72)
 tryCatch({showtext::showtext_begin();tryCatch(render_page(),finally=showtext::showtext_end())},finally=grDevices::dev.off())
}
cfg$coast_files <- coast_files
coast_source <- if(!is.null(coast_credit)) {
  c("Coastline and land mask",coast_credit,"License: ODbL 1.0",paste("Tiles:",paste(coast_files,collapse=", ")))
} else {
  "Land mask and coastline: Natural Earth Admin 0 Countries 5.1.1."
}
writeLines(coast_source,file.path(run_dir,"coastline_sources.txt"),useBytes=TRUE)
if(!is.null(freshwater)){
 cfg$freshwater_release<-freshwater$source$release
 cfg$freshwater_lod<-freshwater$level
 file.copy("freshwater-source.json",run_dir)
}
jsonlite::write_json(cfg,file.path(run_dir,"run_settings.json"),auto_unbox=TRUE,pretty=TRUE)
write.csv(st_drop_geometry(sites),file.path(run_dir,"plotted_records.csv"),row.names=FALSE,fileEncoding="UTF-8")
writeLines(capture.output(sessionInfo()),file.path(run_dir,"sessionInfo.txt"))
writeLines(c("SPTopo editable R v4",font_log,"PDF/SVG labels are glyph outlines; edit the source labels and rerun."),file.path(run_dir,"font_report.txt"))
file.copy(list.files(run_dir,full.names=TRUE),"output",overwrite=TRUE)
message("SPTopo v4 completed: ",normalizePath(file.path(run_dir,"map.png"))," | Latest copy: output/map.png")
`;
}
