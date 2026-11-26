"""Prepare bundled Natural Earth isobaths. Requires pyshp and shapely.
Usage: python scripts/prepare-water.py /path/to/extracted-packages [dist/assets]
Sources: https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_bathymetry_all.zip
"""
import json,sys,pathlib,hashlib
import shapefile
from shapely.geometry import shape,mapping,box
from shapely import make_valid
root=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2] if len(sys.argv)>2 else 'dist/assets');out.mkdir(parents=True,exist_ok=True)
world=box(-180,-85,180,85)
def parts(g,allowed):
 if g.is_empty:return
 if g.geom_type in allowed:yield g
 elif hasattr(g,'geoms'):
  for x in g.geoms:yield from parts(x,allowed)
def rounded(v):
 if isinstance(v,(list,tuple)):return [rounded(a) for a in v]
 return round(v,5) if isinstance(v,float) else v
def features(path,tolerance):
 r=shapefile.Reader(str(path),encoding='utf-8')
 for sr in r.iterShapeRecords():
  a=sr.record.as_dict()
  g=shape(sr.shape.__geo_interface__)
  if not g.is_valid:g=make_valid(g)
  g=g.simplify(tolerance,preserve_topology=True).intersection(world)
  for p in parts(g,{'Polygon'}):
   props={'depth':int(a['depth'])}
   m=mapping(p);m['coordinates']=rounded(m['coordinates'])
   yield {'type':'Feature','bbox':rounded(p.bounds),'properties':props,'geometry':m}
meta={'provider':'Natural Earth','license':'Public Domain','scale':'1:10,000,000','accessed':'2026-10-21','coverage':[-180,-85,180,85],'simplification':'topology-preserving; bathymetry 0.01 degrees; rounded to 5 decimals','urls':['https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-bathymetry/'],'archives':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in root.glob('*.zip')}}
bathy=[]
for p in sorted((root/'ne_10m_bathymetry_all').rglob('*.shp')):bathy+=list(features(p,.01))
bathy.sort(key=lambda f:f['properties']['depth'])
for name,data,version in [('bathymetry',bathy,'4.1.0')]:
 path=out/('water-'+name+'.json');path.write_text(json.dumps({'type':'FeatureCollection','source':{**meta,'version':version,'layer':name},'features':data},ensure_ascii=False,separators=(',',':')))
 print(name,len(data),path.stat().st_size)
(out/'water-SOURCES.txt').write_text('Natural Earth water layers, Public Domain.\nBathymetry 4.1.0 (SRTM Plus).\nOriginal scale 1:10,000,000; simplified for browser cartography.\nDepth bands are generalized ranges, not point measurements. No lake bathymetry is implied. Not for navigation or local habitat assessment.\n'+json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
