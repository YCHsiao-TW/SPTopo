"""Import pinned Natural Earth polygons into the existing world asset."""
import json, hashlib, urllib.request
from pathlib import Path
url='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.1/geojson/ne_10m_admin_0_disputed_areas.geojson'
raw=urllib.request.urlopen(url).read(); source=json.loads(raw)
features=[{'type':'Feature','properties':{'name':f['properties']['NAME'],'type':f['properties']['TYPE'],'id':f['properties']['NE_ID']},'geometry':f['geometry']} for f in source['features'] if f['properties']['TYPE'] not in ('Lease','Overlay')]
p=Path(__file__).resolve().parents[1]/'dist/assets/world-countries.geojson'; data=json.loads(p.read_text());data['disputedAreas']={'type':'FeatureCollection','source':url,'version':'5.1.1','sha256':hashlib.sha256(raw).hexdigest(),'excludedTypes':['Lease','Overlay'],'features':features};p.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n');print(len(features),'label exclusion polygons imported')
