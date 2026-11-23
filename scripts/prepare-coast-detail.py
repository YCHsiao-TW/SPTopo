#!/usr/bin/env python3
"""Build OSM coastline detail. Tested with GDAL 3.10.3, pyshp 3.1.6, shapely 2.2.0.
Run: python scripts/prepare-coast-detail.py qa/coast-detail/land-polygons-complete-4326.zip
Downloads: https://osmdata.openstreetmap.de/data/land-polygons.html
"""
import sys, pathlib, json, hashlib, math, subprocess, shutil
import shapefile
from shapely.geometry import shape, mapping, box, LineString, MultiPolygon
from shapely.geometry.polygon import orient
from shapely import make_valid
SRC=pathlib.Path(sys.argv[1]).resolve();ROOT=pathlib.Path(__file__).resolve().parents[1];QA=SRC.parent;OUT=ROOT/'dist/assets/coast-detail';shutil.rmtree(OUT,ignore_errors=True);OUT.mkdir(parents=True,exist_ok=True)
SOURCE_HASH=hashlib.file_digest(SRC.open('rb'),'sha256').hexdigest()
cache=QA/'coast-source.sha256'
if cache.exists() and cache.read_text().strip()!=SOURCE_HASH:
 for stem in ['coarse','fine','finecoast']:
  for f in QA.glob(stem+'.*'):f.unlink()
cache.write_text(SOURCE_HASH+'\n')
VSI='/vsizip/'+str(SRC)+'/land-polygons-complete-4326/land_polygons.shp'
ZONE=box(117,20,124,28);WORLD=box(-180,-85,180,85)
def ogr(name,opts):
 p=QA/name
 if not p.exists() or not p.with_suffix('.shx').exists() or p.with_suffix('.shx').stat().st_size==0:
  print('Preparing',name,flush=True);subprocess.run(['ogr2ogr','-overwrite','-f','ESRI Shapefile',str(p),VSI,*opts],check=True)
 return p
coarse=ogr('coarse.shp',['-simplify','0.0015'])
fine=ogr('fine.shp',['-clipsrc','117','20','124','28','-simplify','0.0001'])
finecoast=ogr('finecoast.shp',['-dialect','SQLite','-sql','SELECT ST_Boundary(geometry) AS geometry FROM land_polygons WHERE ST_Intersects(geometry, BuildMbr(117,20,124,28))','-clipsrc','117','20','124','28','-simplify','0.0001','-nlt','MULTILINESTRING'])
print('OGR preparation complete',flush=True)
def pieces(g,typ):
 if g.is_empty:return
 if g.geom_type==typ:yield g
 elif hasattr(g,'geoms'):
  for x in g.geoms:yield from pieces(x,typ)
def rounded(v):
 if isinstance(v,(list,tuple)):return [rounded(x) for x in v]
 return round(v,5) if isinstance(v,float) else v
def feature(g,kind):
 m={'type':g.geom_type,'coordinates':rounded(mapping(g)['coordinates'])}
 g=shape(m)
 if not g.is_valid:g=make_valid(g)
 if kind=='land':
  polys=[orient(p,sign=-1) for p in pieces(g,'Polygon')]
  if not polys:return None
  g=polys[0] if len(polys)==1 else MultiPolygon(polys)
 if g.is_empty:return None
 return {'type':'Feature','bbox':rounded(g.bounds),'properties':{'kind':kind},'geometry':mapping(g)}
def coastlines(g):
 for poly in pieces(g,'Polygon'):
  for ring in [poly.exterior,*poly.interiors]:
   pts=list(ring.coords);line=[]
   for a,b in zip(pts,pts[1:]):
    cut=(abs(a[0]-b[0])<1e-8 and abs(abs(a[0])-180)<1e-6) or (abs(a[1]-b[1])<1e-8 and abs(a[1])>=85)
    if cut:
     if len(line)>1:yield LineString(line)
     line=[]
    else:
     if not line:line=[a]
     line.append(b)
   if len(line)>1:yield LineString(line)
def read(p):
 r=shapefile.Reader(str(p))
 for f in r.iterShapes():
  g=shape(f.__geo_interface__)
  if not g.is_valid:g=make_valid(g)
  yield g
TILES={};OV=[];stats={'source_polygons':0,'detail_land_features':0,'detail_coast_features':0}
def add(g,kind):
 typ='Polygon' if kind=='land' else 'LineString'
 for v in pieces(g,typ):
  if kind=='land' and v.area<(1e-7 if v.intersects(ZONE) else .0001):continue
  b=v.bounds
  for x in range(max(0,int(math.floor((b[0]+180)/10))),min(35,int(math.floor((b[2]+180)/10)))+1):
   for y in range(max(0,int(math.floor((b[1]+90)/10))),min(17,int(math.floor((b[3]+90)/10)))+1):
    cb=box(x*10-180,max(-85,y*10-90),(x+1)*10-180,min(85,(y+1)*10-90))
    if cb.area<=0:continue
    for c in pieces(v.intersection(cb),typ):
     if c.is_empty:continue
     TILES.setdefault(f'{x}_{y}',[]).append(feature(c,kind));stats['detail_'+kind+'_features']+=1
for i,g in enumerate(read(coarse)):
 stats['source_polygons']+=1
 if i%20000==0:print('Processing coarse',i,flush=True)
 # Boundary extracted before subtraction/clipping: no artificial grid edges.
 if g.bounds[3]<-85 or g.bounds[1]>85:continue
 if g.area<(.0000001 if g.intersects(ZONE) else .0001):continue
 g=g.simplify(.005,preserve_topology=True)
 clipped=g.intersection(WORLD)
 for p in pieces(clipped.simplify(.05,preserve_topology=True),'Polygon'):
  if p.area>=.02:
   OV.append(feature(p,'land'));OV.extend(feature(c,'coast') for c in coastlines(p))
 add(clipped.difference(ZONE),'land')
 for c in coastlines(g):add(c.intersection(WORLD).difference(ZONE),'coast')
for g in read(fine):add(g.intersection(ZONE),'land')
for g in read(finecoast):add(g.intersection(ZONE),'coast')
source={'provider':'OpenStreetMap contributors','license':'ODbL-1.0','copyright':'https://www.openstreetmap.org/copyright','attribution':'© OpenStreetMap contributors','source_url':'https://osmdata.openstreetmap.de/download/land-polygons-complete-4326.zip','source_sha256':SOURCE_HASH,'retrieved':'2026-11-02','coverage':[-180,-85,180,85],'processing':'Unsplit coastline-derived land. Exterior clockwise, holes counterclockwise. Original polygon boundaries extracted before grid clipping. World cut edges excluded. Detail initially simplified 0.0015 then generalized at 0.005 degrees, Taiwan vicinity 117–124 E 20–28 N 0.0001; overview .05. Detail islands below .0001 square degrees omitted outside Taiwan vicinity (inside .0000001); overview below .02 omitted. Rounded 5 decimals; invalid polygons after rounding repaired. This is cartographic generalization, not survey accuracy. OSM coastline completeness varies. Inland lakes are not contained in this coast dataset.'}
def write(file,features):
 p=OUT/file;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps({'type':'FeatureCollection','features':[f for f in features if f]},ensure_ascii=False,separators=(',',':')));return p.stat().st_size
index={'source':source,'overview':'overview.json','tiles':{},'stats':stats}
write('overview.json',OV)
def writecell(key,feats,bounds,depth=0):
 feats=[f for f in feats if f]
 file=f'tiles/{key}.json';sz=write(file,feats)
 if sz>2500000 and depth<3:
  (OUT/file).unlink();x0,y0,x1,y1=bounds;mx=(x0+x1)/2;my=(y0+y1)/2
  for n,bb in enumerate([(x0,y0,mx,my),(mx,y0,x1,my),(x0,my,mx,y1),(mx,my,x1,y1)]):
   out=[];cell=box(*bb)
   for f in feats:
    if not shape(f['geometry']).intersects(cell):continue
    for g in pieces(shape(f['geometry']).intersection(cell),'Polygon' if f['properties']['kind']=='land' else 'LineString'):
     out.append(feature(g,f['properties']['kind']))
   if out:writecell(key+'_'+str(n),out,list(bb),depth+1)
 else:index['tiles'][key]={'bbox':bounds,'file':file,'bytes':sz}
for key,feats in sorted(TILES.items()):
 x,y=map(int,key.split('_'));writecell(key,feats,[x*10-180,max(-85,y*10-90),(x+1)*10-180,min(85,(y+1)*10-90)])
index['stats']['total_bytes']=sum(p.stat().st_size for p in OUT.rglob('*.json'))
(OUT/'index.json').write_text(json.dumps(index,ensure_ascii=False,separators=(',',':')))
(OUT/'SOURCES.txt').write_text(json.dumps(source,ensure_ascii=False,indent=2)+'\n'+(QA/'source-readme.txt').read_text() if (QA/'source-readme.txt').exists() else json.dumps(source,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(index['stats']),flush=True)
