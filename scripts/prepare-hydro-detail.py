#!/usr/bin/python3
"""Prepare self-hosted cartographic RiverATLAS v1 + HydroLAKES v1 vectors.
Requires GDAL Python bindings (Debian /usr/bin/python3), no network at runtime.
Usage: /usr/bin/python3 scripts/prepare-hydro-detail.py --cache qa/hydro-detail --out dist/assets/hydro-detail
Download the two ZIPs from SOURCES below into --cache first. Processes are bounded
by a global major-water subset plus all eligible source features around Taiwan.
Whole features are repeated across intersecting cells: clients MUST deduplicate
by (properties.kind, properties.id) before rendering. This avoids artificial cell
edge strokes through lakes. Lake exteriors are clockwise for spherical D3 GeoJSON.
"""
import argparse,collections,hashlib,json,math,pathlib,zipfile,datetime
from osgeo import ogr,gdal
ogr.UseExceptions();gdal.SetConfigOption('CPL_VSIL_ZIP_ALLOWED_EXTENSIONS','.zip')
SOURCES={
 'rivers':{'file':'RiverATLAS_Data_v10_shp.zip','url':'https://s3-eu-west-1.amazonaws.com/pfigshare-u-files/20087486/RiverATLAS_Data_v10_shp.zip','page':'https://www.hydrosheds.org/hydroatlas','license':'CC BY 4.0','citation':'Linke et al. (2019). Global hydro-environmental sub-basin and river reach characteristics at high spatial resolution. Scientific Data 6:283. https://doi.org/10.1038/s41597-019-0300-6'},
 'lakes':{'file':'HydroLAKES_polys_v10_shp.zip','url':'https://data.hydrosheds.org/file/hydrolakes/HydroLAKES_polys_v10_shp.zip','page':'https://www.hydrosheds.org/products/hydrolakes','license':'CC BY 4.0','citation':'Messager et al. (2016). Estimating the volume and age of water stored in global lakes using a geo-statistical approach. Nature Communications 7:13603. https://doi.org/10.1038/ncomms13603'}
}
TW=(119.5,21.5,122.5,25.7)
def overlap(a,b):return a[0]<=b[2] and a[2]>=b[0] and a[1]<=b[3] and a[3]>=b[1]
def bbox(g):
 a=g.GetEnvelope();return [round(a[0],5),round(a[2],5),round(a[1],5),round(a[3],5)]
def rounded(v):
 if isinstance(v,(list,tuple)):return [rounded(x) for x in v]
 return round(v,5) if isinstance(v,float) else v
def orient(g):
 def ring(r,cw):
  area=sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(r,r[1:]));return r[::-1] if (area>0)==cw else r
 def poly(p):return [ring(r,i==0) for i,r in enumerate(p)]
 if g['type']=='Polygon':g['coordinates']=poly(g['coordinates'])
 elif g['type']=='MultiPolygon':g['coordinates']=[poly(p) for p in g['coordinates']]
 return g
def feature(geom,props,tol):
 if props['kind']=='lakes':
  d=json.loads(geom.ExportToJson()); polys=[d['coordinates']] if d['type']=='Polygon' else d['coordinates']
  def area(r):return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(r,r[1:])))/2
  cut=4*tol*tol; largest=max(range(len(polys)),key=lambda i:area(polys[i][0]))
  polys=[[p[0]]+[r for r in p[1:] if area(r)>=cut] for i,p in enumerate(polys) if i==largest or area(p[0])>=cut]
  d={'type':'MultiPolygon','coordinates':polys};geom=ogr.CreateGeometryFromJson(json.dumps(d))
 g=geom.SimplifyPreserveTopology(tol) if tol else geom.Clone()
 if g.IsEmpty():return None
 return {'type':'Feature','bbox':bbox(g),'properties':props,'geometry':orient(rounded(json.loads(g.ExportToJson())))}
def open_layer(cache,kind):
 zpath=cache/SOURCES[kind]['file']; z=zipfile.ZipFile(zpath); shapes=[n for n in z.namelist() if n.lower().endswith('.shp')]
 if len(shapes)==1:
  ds=ogr.Open('/vsizip/'+str(zpath.resolve())+'/'+shapes[0]);return ds,ds.GetLayer(0)
 import html
 layers=''.join('<OGRVRTLayer name="'+pathlib.Path(n).stem+'"><SrcDataSource>'+html.escape('/vsizip/'+str(zpath.resolve())+'/'+n)+'</SrcDataSource><SrcLayer>'+pathlib.Path(n).stem+'</SrcLayer></OGRVRTLayer>' for n in shapes)
 vrt=cache/(kind+'-sources.vrt');vrt.write_text('<OGRVRTDataSource><OGRVRTUnionLayer name="'+kind+'"><FieldStrategy>Intersection</FieldStrategy>'+layers+'</OGRVRTUnionLayer></OGRVRTDataSource>')
 ds=ogr.Open(str(vrt));return ds,ds.GetLayer(0)
def emit(path,features):
 path.write_text(json.dumps({'type':'FeatureCollection','features':features},ensure_ascii=False,separators=(',',':'))+'\n')
def compact_existing(out):
 index=json.loads((out/'index.json').read_text());cache={};counts=collections.Counter()
 for name in [index['overview']]+[t['file'] for t in index['tiles'].values()]:
  overview=name==index['overview'];data=json.loads((out/name).read_text());features=[]
  for f in data['features']:
   key=(overview,f['properties']['kind'],f['properties']['id'])
   if key not in cache:
    p=f['properties'];tw=overlap(f['bbox'],TW)
    if p['kind']=='lakes' and p['area']<50 and not tw:cache[key]=None
    else:
     tol=.04 if overview else (.0002 if p['kind']=='lakes' else .0004) if tw else .005
     cache[key]=feature(ogr.CreateGeometryFromJson(json.dumps(f['geometry'])),p,tol)
   if cache[key]:features.append(cache[key])
  emit(out/name,features)
  if not overview:
   for t in index['tiles'].values():
    if t['file']==name:t['features']=len(features)
 source=index['source'];source['selection']['global_lakes']='surface area >=50 km² (Taiwan additional source selection retained)'
 source['processing']=source['processing'].split(' Final cartographic compaction:')[0]+' Final cartographic compaction: globally omit lakes below50 km²; simplify rivers/lakes again at0.005°; overview at0.04°. Taiwan retains0.0004° rivers/0.0002° lakes. Small lake-island holes and minor multipart components below4×final-tolerance² square degrees are omitted, preserving each lake’s largest component.'
 source['statistics']['displayUnique']=dict(collections.Counter(key[1] for key,v in cache.items() if not key[0] and v))
 source['statistics']['payloadBytes']=sum((out/n).stat().st_size for n in [index['overview']]+[t['file'] for t in index['tiles'].values()])
 (out/'index.json').write_text(json.dumps(index,ensure_ascii=False,separators=(',',':'))+'\n')
 (out/'SOURCES.txt').write_text('WorldBioTopoMaps detailed inland-water cartography\n\n'+json.dumps(source,ensure_ascii=False,indent=2)+'\n\nRiverATLAS and HydroLAKES used under CC BY4.0. Modified by the documented selection, merging, simplification, hole removal and rounding. No endorsement is implied.\n')
 print('COMPACT',source['statistics']['payloadBytes'],'bytes',flush=True)
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--compact-existing',action='store_true');ap.add_argument('--cache',type=pathlib.Path,default=pathlib.Path('qa/hydro-detail'));ap.add_argument('--out',type=pathlib.Path,default=pathlib.Path('dist/assets/hydro-detail'));a=ap.parse_args();a.out.mkdir(parents=True,exist_ok=True)
 if a.compact_existing:compact_existing(a.out);return
 cells=collections.defaultdict(list);overview=[];stats={}; sources={}
 def add(f):
  b=f['bbox']
  for x in range(max(0,int(math.floor((b[0]+180)/10))),min(35,int(math.floor((b[2]+180)/10)))+1):
   for y in range(max(0,int(math.floor((b[1]+90)/10))),min(17,int(math.floor((b[3]+90)/10)))+1):cells[f'{x}_{y}'].append(f)
 for kind in SOURCES:
  print('Reading',kind,flush=True);ds,l=open_layer(a.cache,kind)
  if kind=='rivers':
   print('Fields',[f.name for f in l.schema][:22],flush=True)
   names={f.name.lower():f.name for f in l.schema}; up=names.get('upland_skm');q=names.get('dis_av_cms');idkey=names.get('hyriv_id');nextkey=names.get('next_down');
   if not all([up,q,idkey,nextkey]):raise RuntimeError('RiverATLAS field schema changed')
   l.SetIgnoredFields([f.name for f in l.schema if f.name not in [up,q,idkey,nextkey]])
   l.SetAttributeFilter(f'{up} >= 10000 OR {q} >= 100')
   records={}
   for f in l:
    g=f.GetGeometryRef();b=bbox(g)
    if b[1]>85 or b[3]<-85:continue
    flow=float(f[q]);rank=1 if flow>=1000 else 2 if flow>=100 else 3
    records[int(f[idkey])]=(int(f[nextkey]),rank,float(f[up]),flow,g.Clone())
   l.SetAttributeFilter(None);l.SetSpatialFilterRect(*TW)
   for f in l:
    g=f.GetGeometryRef();flow=float(f[q]);rank=1 if flow>=1000 else 2 if flow>=100 else 3 if flow>=10 else 4
    records[int(f[idkey])]=(int(f[nextkey]),rank,float(f[up]),flow,g.Clone())
   print('Selected reaches',len(records),flush=True)
   incoming=collections.defaultdict(list)
   for id,r in records.items():incoming[r[0]].append(id)
   used=set();count=0
   for start,r in records.items():
    parent=incoming[start]
    if len(parent)==1 and records[parent[0]][1]==r[1]:continue
    if start in used:continue
    current=start;pts=[];ids=[];maxflow=0;maxup=0
    while current in records and current not in used:
     rr=records[current];g=rr[4]
     if g.GetGeometryType() in (ogr.wkbMultiLineString,ogr.wkbMultiLineString25D):
      lines=[g.GetGeometryRef(i).GetPoints() for i in range(g.GetGeometryCount())]
      pp=[list(p[:2]) for line in lines for p in line]
     else:pp=[list(p[:2]) for p in g.GetPoints()]
     if pts and pp and abs(pts[-1][0]-pp[-1][0])+abs(pts[-1][1]-pp[-1][1])<1e-6:pp.reverse()
     if pts and pp and abs(pts[-1][0]-pp[0][0])+abs(pts[-1][1]-pp[0][1])>1e-5:break
     pts+=pp[1:] if pts else pp;used.add(current);ids.append(current);maxflow=max(maxflow,rr[3]);maxup=max(maxup,rr[2]);nxt=rr[0]
     if nxt not in records or len(incoming[nxt])!=1 or records[nxt][1]!=r[1]:break
     current=nxt
    if len(pts)<2:continue
    g=ogr.Geometry(ogr.wkbLineString)
    for p in pts:g.AddPoint_2D(*p)
    props={'kind':'rivers','id':'r'+str(start),'rank':r[1],'area':round(maxup,1),'flow':round(maxflow,2),'reaches':len(ids)}
    tw=overlap(bbox(g),TW);f=feature(g,props,.0004 if tw else .004);add(f);count+=1
    if maxup>=100000 or maxflow>=1000:overview.append(feature(g,props,.025))
   # Cyclic/unjoined exceptional reaches remain individually represented.
   for id,r in records.items():
    if id in used:continue
    props={'kind':'rivers','id':'r'+str(id),'rank':r[1],'area':round(r[2],1),'flow':round(r[3],2),'reaches':1};add(feature(r[4],props,.004));count+=1
   stats[kind]={'selectedSourceReaches':len(records),'mergedDisplayFeatures':count}
  else:
   l.SetIgnoredFields([f.name for f in l.schema if f.name not in ['Hylak_id','Lake_area','Lake_name']]);l.SetAttributeFilter('Lake_area >= 10');selected={}
   for f in l:selected[int(f['Hylak_id'])]=(f.GetGeometryRef().Clone(),float(f['Lake_area']),str(f['Lake_name'] or ''))
   l.SetAttributeFilter(None);l.SetSpatialFilterRect(*TW)
   for f in l:selected[int(f['Hylak_id'])]=(f.GetGeometryRef().Clone(),float(f['Lake_area']),str(f['Lake_name'] or ''))
   for id,(g,area,name) in selected.items():
    b=bbox(g)
    if b[1]>85 or b[3]<-85:continue
    props={'kind':'lakes','id':'l'+str(id),'rank':1 if area>=250 else 3,'area':area,'name':name}
    f=feature(g,props,.0002 if overlap(b,TW) else .003);add(f)
    if area>=250:overview.append(feature(g,props,.025))
   stats[kind]={'selectedSourceLakes':len(selected)}
  sources[kind]={**SOURCES[kind],'sha256':hashlib.file_digest(open(a.cache/SOURCES[kind]['file'],'rb'),'sha256').hexdigest()}
  ds=None;print('Done',kind,stats[kind],flush=True)
 for old in a.out.glob('*.json'):old.unlink()
 emit(a.out/'overview.json',overview)
 index={}
 for key,features in sorted(cells.items()):
  emit(a.out/(key+'.json'),features);x,y=map(int,key.split('_'));index[key]={'bbox':[x*10-180,max(-85,y*10-90),x*10-170,min(85,y*10-80)],'file':key+'.json','features':len(features)}
 source={'products':'RiverATLAS v1 + HydroLAKES v1','license':'CC BY 4.0','license_url':'https://creativecommons.org/licenses/by/4.0/','accessed':datetime.date.today().isoformat(),'datasets':sources,'coverage':[-180,-85,180,85],'selection':{'global_rivers':'upstream area >=10000 km² OR average discharge >=100 m³/s','global_lakes':'surface area >=10 km²','taiwan':'All source rivers and lakes intersecting '+str(TW),'overview':'rivers upstream area>=100000 km² or discharge>=1000 m³/s; lakes>=250 km²'},'processing':'Selected same-rank connected river reaches merged without merging across junctions. Topology-preserving display simplification: rivers 0.004°, lakes 0.003°; Taiwan rivers 0.0004°, lakes 0.0002°; overview 0.025°. Coordinates rounded to 5 decimals. Whole features repeated across cells; deduplicate by kind+id. Lake-island holes smaller than 4×tolerance² square degrees are omitted before simplification; multipart lake components below the same threshold are omitted while preserving each lake’s largest component. Lake rings oriented clockwise exterior for spherical rendering.','limitations':'Cartographic subset, not complete river/lake source databases; small streams/ponds omitted. River source baseline 15 arc-seconds, catchment>=10 km² or discharge>=0.1 m³/s; lake source>=10 hectares. Taiwan bbox is an additional selection, not a promise of completeness. Small lake islands/components can be omitted by display generalization; water may be painted over those small islands. Lake fill is uniform and does not depict depth. Source geometry dates are not live water extent.','statistics':stats}
 (a.out/'index.json').write_text(json.dumps({'source':source,'overview':'overview.json','tiles':index},ensure_ascii=False,separators=(',',':'))+'\n')
 (a.out/'SOURCES.txt').write_text('WorldBioTopoMaps detailed inland-water cartography\n\n'+json.dumps(source,ensure_ascii=False,indent=2)+'\n\nRiverATLAS and HydroLAKES are used under CC BY 4.0. Modified by filtering, merging, simplifying and rounding as described above. No endorsement is implied.\n')
 # Two deterministic compaction passes match the checked-in display assets.
 compact_existing(a.out)
 compact_existing(a.out)
 print('OUTPUT',sum(p.stat().st_size for p in a.out.iterdir()),'bytes;',len(index),'cells; overview',len(overview),flush=True)
if __name__=='__main__':main()
