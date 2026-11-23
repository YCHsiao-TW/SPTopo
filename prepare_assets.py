from pathlib import Path
import json,math,urllib.request,concurrent.futures
root=Path(__file__).parent/'dist/assets'
topo=json.loads((root/'taiwan-topology.json').read_text())
sx,sy=topo['transform']['scale'];tx,ty=topo['transform']['translate']
arcs=[]
for arc in topo['arcs']:
 x=y=0;out=[]
 for a,b in arc:
  x+=a;y+=b;out.append([round(x*sx+tx,6),round(y*sy+ty,6)])
 arcs.append(out)
def ring(ids):
 out=[]
 for i in ids:
  arc=arcs[i] if i>=0 else list(reversed(arcs[~i]))
  out.extend(arc if not out else arc[1:])
 return out
def geometry(g):
 if g['type']=='Polygon':return {'type':'Polygon','coordinates':[ring(r) for r in g['arcs']]}
 if g['type']=='MultiPolygon':return {'type':'MultiPolygon','coordinates':[[ring(r) for r in p] for p in g['arcs']]}
 raise ValueError(g['type'])
data={}
for k,v in topo['objects'].items():
 data[k]={'type':'FeatureCollection','features':[{'type':'Feature','properties':g.get('properties',{}),'geometry':geometry(g)} for g in v['geometries']]}
(root/'boundaries.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
def tile(lon,lat,z):return int((lon+180)/360*2**z),int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z)
tasks=set()
# Package z8 so the default map needs no third-party network request.
for z,bbox in [(8,(117.8,21.3,123.2,26.6))]:
 x0,y0=tile(bbox[0],bbox[3],z);x1,y1=tile(bbox[2],bbox[1],z)
 for x in range(x0,x1+1):
  for y in range(y0,y1+1):tasks.add((z,x,y))
def download(t):
 z,x,y=t;p=root/f'terrain/{z}/{x}/{y}.png';p.parent.mkdir(parents=True,exist_ok=True)
 if not p.exists():
  for attempt in range(3):
   try:
    b=urllib.request.urlopen(f'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png',timeout=25).read()
    if not b.startswith(b'\x89PNG'):raise ValueError('Invalid tile')
    p.write_bytes(b);break
   except Exception:
    if attempt==2:raise
 return '/'.join(map(str,t))
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:downloaded=list(pool.map(download,sorted(tasks)))
(root/'terrain-index.json').write_text(json.dumps(downloaded))
license_text=urllib.request.urlopen('https://raw.githubusercontent.com/dkaoster/taiwan-atlas/master/LICENSE',timeout=20).read()
(root/'taiwan-atlas-LICENSE.txt').write_bytes(license_text)
print(json.dumps({'towns':len(data['towns']['features']),'counties':len(data['counties']['features']),'tiles':len(downloaded),'boundary_bytes':(root/'boundaries.json').stat().st_size}))
