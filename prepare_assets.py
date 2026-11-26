from pathlib import Path
import json,math,urllib.request,concurrent.futures
root=Path(__file__).parent/'dist/assets'
def tile(lon,lat,z):return int((lon+180)/360*2**z),int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**z)
tasks=set()
# Refresh the bundled z8 regional elevation cache.
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
index=root/'terrain-index.json'
existing=json.loads(index.read_text()) if index.exists() else []
index.write_text(json.dumps(sorted(set(existing+downloaded)))+'\n')
print(json.dumps({'tiles':len(downloaded)}))
