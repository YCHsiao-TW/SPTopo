"""Prepare Natural Earth Admin 1 lines and labels with pyshp, shapely and OpenCC."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import urllib.request
import zipfile

import shapefile
from opencc import OpenCC
from shapely.geometry import shape, mapping, box, Point
from shapely import make_valid

parser = argparse.ArgumentParser()
parser.add_argument('--data-dir', type=Path, required=True)
args = parser.parse_args()
args.data_dir.mkdir(parents=True, exist_ok=True)
root = Path(__file__).parent / 'dist' / 'assets'
sources = {
    'ne_10m_admin_1_states_provinces_lines': ('5.1.0', '86acd56ce6c0e47f5fa79725591533b5766f26d6ed1437b086f2b8d4028fe456'),
    'ne_10m_admin_1_states_provinces': ('5.1.1', 'efc59726337323058f9446210adc96673179cd344e053666ee3d28cb58ba2b05'),
}
for stem, (version, digest) in sources.items():
    archive = args.data_dir / (stem + '.zip')
    if not archive.exists():
        with urllib.request.urlopen('https://naciscdn.org/naturalearth/10m/cultural/' + stem + '.zip', timeout=45) as response:
            archive.write_bytes(response.read())
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == digest, stem + ': unexpected source archive'
    with zipfile.ZipFile(archive) as z:
        for name in z.namelist():
            if Path(name).name != name:
                raise ValueError('Unexpected archive path')
        z.extractall(args.data_dir)
    assert (args.data_dir / (stem + '.VERSION.txt')).read_text().strip() == version

def clean(value):
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [clean(v) for v in value]
    return round(value, 5) if isinstance(value, float) else value

extent = box(-180, -85, 180, 85)
features = []
reader = shapefile.Reader(str(args.data_dir / 'ne_10m_admin_1_states_provinces_lines.shp'), encoding='utf-8')
for record in reader.iterShapeRecords():
    if record.shape.shapeType == 0:
        continue
    properties = record.record.as_dict()
    geometry = shape(record.shape.__geo_interface__).intersection(extent)
    if geometry.is_empty:
        continue
    geometry = geometry.simplify(.015, preserve_topology=True)
    if geometry.geom_type not in ('LineString', 'MultiLineString'):
        continue
    features.append({'type': 'Feature', 'properties': {'country': properties['ADM0_A3']}, 'bbox': clean(geometry.bounds), 'geometry': clean(mapping(geometry))})

labels = []
traditional = OpenCC('s2twp')
reader = shapefile.Reader(str(args.data_dir / 'ne_10m_admin_1_states_provinces.shp'), encoding='utf-8')
for record in reader.iterShapeRecords():
    if record.shape.shapeType == 0:
        continue
    properties = record.record.as_dict()
    geometry = shape(record.shape.__geo_interface__)
    if not geometry.is_valid:
        geometry = make_valid(geometry)
    geometry = geometry.intersection(extent)
    if geometry.is_empty:
        continue
    lon, lat = properties.get('longitude'), properties.get('latitude')
    label = Point(lon, lat) if isinstance(lon, (float, int)) and isinstance(lat, (float, int)) and math.isfinite(lon) and math.isfinite(lat) else None
    if label is None or not geometry.covers(label):
        label = geometry.representative_point()
    name_zh = properties['name_zht'] or properties['name_zh'] or properties['name']
    labels.append({'country': properties['adm0_a3'], 'code': properties['adm1_code'], 'name': properties['name'], 'name_en': properties['name_en'] or properties['name'], 'name_zh': name_zh, 'label': clean([label.x, label.y]), 'bbox': clean(geometry.bounds), 'name_zh_hant': traditional.convert(name_zh)})
labels.sort(key=lambda f: (f['bbox'][2] - f['bbox'][0]) * (f['bbox'][3] - f['bbox'][1]), reverse=True)
data = {'type': 'FeatureCollection', 'features': features, 'labels': labels, 'source': {'provider': 'Natural Earth', 'scale': '1:10 million', 'boundary_version': '5.1.0', 'label_version': '5.1.1', 'accessed': '2026-10-20', 'simplify_degrees': .015, 'archive_sha256': {k: v[1] for k, v in sources.items()}}}
output = root / 'world-admin1.json'
output.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
print(json.dumps({'lines': len(features), 'labels': len(labels), 'countries': len({f['country'] for f in labels}), 'bytes': output.stat().st_size}))
