#!/usr/bin/env python3
"""Package prepared freshwater tiles for static hosting with a bounded archive size."""
import argparse
from concurrent.futures import ProcessPoolExecutor
import gzip
import json
from pathlib import Path
import shutil
import struct

import numpy as np
from shapely.geometry import Polygon
from shapely.errors import GEOSException

# Match the cartographic tolerances of the two finest tiers. Units are
# multiples of the source tile grid. Coarse overview and continental tiles
# remain plain TopoJSON, and the regional tier retains every coordinate.
GRID_MULTIPLES = {2: 1, 3: 2, 4: 4}


def encode(value):
    return json.dumps(value, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()


def varint(output, value):
    while value >= 128:
        output.append((value & 127) | 128)
        value >>= 7
    output.append(value)


def signed(value):
    return 2 * value if value >= 0 else -2 * value - 1


def polygon_references(topology):
    for feature in topology['objects']['freshwater']['geometries']:
        if feature['type'] == 'Polygon':
            yield feature['arcs']
        if feature['type'] == 'MultiPolygon':
            yield from feature['arcs']


def rounded_arc(arc, step):
    coordinates = np.cumsum(arc, axis=0)
    rounded = np.rint(coordinates / step).astype('int32')
    keep = np.r_[True, np.any(rounded[1:] != rounded[:-1], axis=1)]
    return rounded[keep]


def polygon_with_rings(rings, coordinates, step):
    def ring(refs):
        joined = []
        for ref in refs:
            values = coordinates[ref if ref >= 0 else ~ref]
            if ref < 0:
                values = values[::-1]
            start = 1 if joined else 0
            joined.extend(values[start:].tolist())
        return [(x * step, y * step) for x, y in joined]

    return Polygon(ring(rings[0]), [ring(r) for r in rings[1:]])


def packed_tile(topology, step):
    arcs = topology.pop('arcs')
    rounded = []
    retain = set()
    if step > 1:
        rounded = [rounded_arc(arc, step) for arc in arcs]
        retain.update(index for index, values in enumerate(rounded) if len(values) < 2)
        for rings in polygon_references(topology):
            try:
                if polygon_with_rings(rings, rounded, step).is_valid:
                    continue
            except (GEOSException, ValueError):
                pass
            # Retain original precision for narrow rings and polygons whose
            # validity would change on the coarser grid.
            retain.update(ref if ref >= 0 else ~ref for ring in rings for ref in ring)

    header = encode(topology)
    body = bytearray(struct.pack('<4sI', b'SPW1', len(header)))
    body.extend(header)
    varint(body, len(arcs))
    for index, original in enumerate(arcs):
        scale = 1
        deltas = original
        if step > 1 and index not in retain:
            scale = step
            coordinates = rounded[index]
            deltas = np.diff(coordinates, axis=0, prepend=[[0, 0]]).tolist()
        varint(body, scale)
        varint(body, len(deltas))
        for x, y in deltas:
            varint(body, signed(x))
            varint(body, signed(y))
    return gzip.compress(body, compresslevel=9, mtime=0)


def package_tile(task):
    source, target, level = task
    if not target.is_file():
        target.parent.mkdir(parents=True, exist_ok=True)
        if level in GRID_MULTIPLES:
            with gzip.open(source, 'rb') as stream:
                topology = json.load(stream)
            if level == 3:
                for feature in topology['objects']['freshwater']['geometries']:
                    feature['properties'].pop('id', None)
                    feature['properties'].pop('reaches', None)
            temporary = target.with_suffix('.pending')
            temporary.write_bytes(packed_tile(topology, GRID_MULTIPLES[level]))
            temporary.replace(target)
        else:
            shutil.copyfile(source, target)
    return target.stat().st_size


def build(source, output, jobs):
    output.mkdir(parents=True, exist_ok=True)
    with (source / 'index.json').open() as stream:
        index = json.load(stream)
    tasks = []
    levels = []
    for key, entry in index['tiles'].items():
        level = int(key.split('/')[0])
        original = source / entry['file']
        if level in GRID_MULTIPLES:
            entry['file'] = entry['file'].replace('.json.gz', '.bin.gz')
        tasks.append((original, output / entry['file'], level))
        levels.append(level)
    sizes = {level: [] for level in range(1, 5)}
    with ProcessPoolExecutor(max_workers=jobs) as pool:
        for count, (level, size) in enumerate(zip(levels, pool.map(package_tile, tasks), strict=True), 1):
            sizes[level].append(size)
            if count % 250 == 0 or count == len(tasks):
                print(f'{count}/{len(tasks)} tiles packaged', flush=True)

    for name in ('world.json.gz', 'source-objects.json'):
        shutil.copyfile(source / name, output / name)
    metadata = index['source']
    metadata['format'] = 'TopoJSON (gzip and SPW1 delta-encoded tiles)'
    metadata['packingGridMultiples'] = {str(level): step for level, step in GRID_MULTIPLES.items()}
    metadata['packing'] = 'Original precision retained when snapping would invalidate a polygon or collapse an arc.'
    metadata['packingProperties'] = 'The two finest tiers retain feature names and styles and omit temporary identifiers and reach counts.'
    data = encode(index)
    (output / 'index.json').write_bytes(data)
    (output / 'index.json.gz').write_bytes(gzip.compress(data, compresslevel=5, mtime=0))
    (output / 'SOURCES.txt').write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + '\n')
    stats = {str(level): {'files': len(values), 'bytes': sum(values), 'maxBytes': max(values, default=0)}
             for level, values in sizes.items()}
    stats['0'] = {'files': 1, 'bytes': (output / 'world.json.gz').stat().st_size}
    (output / 'stats.json').write_text(json.dumps(stats, indent=2) + '\n')
    print(f'Total tile bytes: {sum(row["bytes"] for row in stats.values())}', flush=True)
    # Use the same checksum manifest writer as the preparation stage.
    from runpy import run_path
    compiler = run_path(str(Path(__file__).resolve().with_name('prepare-osm-freshwater.py')))
    compiler['publish_manifest'](output, index['tiles'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--jobs', type=int, default=5)
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        parser.error('Use a separate packaging directory')
    build(args.source.resolve(), args.output.resolve(), args.jobs)


if __name__ == '__main__':
    main()
