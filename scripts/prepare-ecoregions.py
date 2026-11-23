#!/usr/bin/env python3
"""Build browser vectors from the original RESOLVE Ecoregions 2017 shapefile.

Requires Python 3.10+, pyshp==3.1.6 and shapely==2.2.0 (GEOS 3.14.1 used).
  python -m pip install pyshp==3.1.6 shapely==2.2.0
  python scripts/prepare-ecoregions.py --source /path/Ecoregions2017.zip
Omit --source to download the producer's public, checksum-pinned archive.
Outputs default to dist/assets relative to this repository, not the current cwd.

This is a cartographic generalization, not a scientific point-attribution layer.
Source holes are retained in surviving polygon components. Tiny disconnected
parts may be omitted, but the largest part of every source ecoregion is kept.
"""

from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import date
import hashlib
import json
import math
from pathlib import Path
import tempfile
from urllib.request import urlopen
from zipfile import ZipFile

import shapefile
import shapely
from shapely import make_valid, set_precision, union_all
from shapely.geometry import MultiPolygon, Point, Polygon, mapping, shape
from shapely.geometry.polygon import orient

SOURCE_URL = "https://storage.googleapis.com/teow2016/Ecoregions2017.zip"
SOURCE_SHA256 = "be36d6209e443038d02e309f0447c6e7f2a62f5fe60c605ffe90d064952f2a60"
CATALOG_URL = "https://developers.google.com/earth-engine/datasets/catalog/RESOLVE_ECOREGIONS_2017"
PRODUCER_URL = "https://ecoregions.appspot.com/"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
DOI = "https://doi.org/10.1093/biosci/bix014"
COLOR_UPDATES = {204: "#B3493B", 245: "#267400", 259: "#004600", 286: "#82F178",
                 316: "#E600AA", 453: "#5AA500", 317: "#FDA87F", 763: "#A93800"}


def polygons(geometry):
    """Only polygonal pieces; validity repair can also return collapsed lines."""
    if geometry.is_empty:
        return []
    if geometry.geom_type == "Polygon":
        return [geometry]
    if hasattr(geometry, "geoms"):
        return [part for child in geometry.geoms for part in polygons(child)]
    return []


def polygon_geometry(parts):
    if not parts:
        raise ValueError("Empty polygon geometry")
    return parts[0] if len(parts) == 1 else MultiPolygon(parts)


def polygon_counts(geometry):
    parts = polygons(geometry)
    return {"parts": len(parts), "holes": sum(len(p.interiors) for p in parts),
            "vertices": int(shapely.get_num_coordinates(geometry))}


def keep_components(geometry, minimum_area, protected_points=()):
    parts = polygons(geometry)
    largest = max(parts, key=lambda p: p.area)
    anchors = [(point.x, point.y, point) for point in protected_points]
    kept = []
    for polygon in parts:
        if polygon is largest or polygon.area >= minimum_area:
            kept.append(polygon)
            continue
        west, south, east, north = polygon.bounds
        if any(west <= x <= east and south <= y <= north and polygon.covers(point)
               for x, y, point in anchors):
            kept.append(polygon)
    return polygon_geometry(kept), len(parts) - len(kept)


def generalize(geometry, tolerance, minimum_area, protected_points=()):
    geometry, omitted = keep_components(geometry, minimum_area, protected_points)
    before = polygon_counts(geometry)
    geometry = geometry.simplify(tolerance, preserve_topology=True)
    # valid_output repairs rings affected by coordinate quantization and removes
    # only features that collapse below the approximately metre-scale grid.
    geometry = set_precision(geometry, grid_size=0.00001, mode="valid_output")
    geometry = polygon_geometry(polygons(geometry))
    if not geometry.is_valid or geometry.is_empty:
        raise ValueError("Invalid or empty generalized polygon")
    return geometry, omitted, before


def rounded(value):
    if isinstance(value, (list, tuple)):
        return [rounded(v) for v in value]
    return round(value, 5) if isinstance(value, float) else value


def geographic_ring(ring):
    """Keep long polar Cartesian edges from becoming across-world d3 arcs."""
    coords = list(ring)
    output = []
    for start, end in zip(coords, coords[1:]):
        output.append(rounded(start))
        # Original seam pieces are never joined. A long segment within one piece
        # is subdivided along that same segment, rather than wrapped or shifted.
        steps = max(1, math.ceil(abs(end[0] - start[0]) / 90))
        for step in range(1, steps):
            t = step / steps
            output.append(rounded([start[0] + t * (end[0] - start[0]),
                                   start[1] + t * (end[1] - start[1])]))
    output.append(output[0])
    return output


def geojson_geometry(geometry):
    coords = []
    for polygon in polygons(geometry):
        # d3-geo uses clockwise outer rings and counterclockwise holes for small
        # spherical polygons (opposite to RFC 7946's recommended winding).
        polygon = orient(polygon, sign=-1)
        coords.append([geographic_ring(polygon.exterior.coords)]
                      + [geographic_ring(hole.coords) for hole in polygon.interiors])
    return {"type": "Polygon", "coordinates": coords[0]} if len(coords) == 1 else {
        "type": "MultiPolygon", "coordinates": coords}


def interior_label(geometry):
    polygon = max(polygons(geometry), key=lambda p: p.area)
    point = polygon.representative_point()
    candidate = rounded([point.x, point.y])
    return candidate if polygon.contains(Point(candidate)) else [point.x, point.y]


def feature(identifier, properties, geometry):
    result = {"type": "Feature", "id": identifier, "bbox": rounded(geometry.bounds),
              "properties": {**properties, "label": interior_label(geometry)},
              "geometry": geojson_geometry(geometry)}
    encoded = shape(result["geometry"])
    if not encoded.is_valid or encoded.is_empty:
        raise ValueError(f"Serialized feature {identifier} is invalid")
    if not encoded.covers(Point(result["properties"]["label"])):
        raise ValueError(f"Label for feature {identifier} is outside its geometry")
    return result


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n",
                    encoding="utf-8")
    return {"bytes": path.stat().st_size,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def load_source(source, temporary):
    if source is None:
        source = temporary / "Ecoregions2017.zip"
        print(f"Downloading {SOURCE_URL}", flush=True)
        with urlopen(SOURCE_URL, timeout=120) as response, source.open("wb") as output:
            while block := response.read(1024 * 1024):
                output.write(block)
    source = Path(source)
    if source.is_dir():
        archive = source / "Ecoregions2017.zip"
        if not archive.exists():
            raise ValueError("Source directory must contain the checksum-pinned archive")
        source = archive
    checksum = hashlib.sha256(source.read_bytes()).hexdigest()
    if checksum != SOURCE_SHA256:
        raise ValueError(f"Unexpected source archive checksum: {checksum}")
    with ZipFile(source) as archive:
        for extension in ("shp", "shx", "dbf", "prj"):
            filename = "Ecoregions2017." + extension
            (temporary / filename).write_bytes(archive.read(filename))
    return temporary / "Ecoregions2017.shp", source.stat().st_size


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "dist/assets")
    parser.add_argument("--accessed", default=date.today().isoformat())
    parser.add_argument("--ecoregion-tolerance", type=float, default=0.04)
    parser.add_argument("--biome-tolerance", type=float, default=0.06)
    parser.add_argument("--ecoregion-min-area", type=float, default=0.00005)
    parser.add_argument("--biome-min-area", type=float, default=0.0002)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    biome_geometries = defaultdict(list)
    biome_metadata = {}
    biome_labels = defaultdict(list)
    ecoregions = []
    repaired_ids = []
    omissions = {}
    source_counts = {"parts": 0, "holes": 0, "vertices": 0}
    quantization_holes_collapsed = 0

    with tempfile.TemporaryDirectory(prefix="resolve-ecoregions-") as work:
        shapefile_path, archive_bytes = load_source(args.source, Path(work))
        source_crs = shapefile_path.with_suffix(".prj").read_text()
        # The original archive has no .cpg. UTF-8 fails on accented DBF names;
        # Windows-1252 correctly decodes source names including Alto Paraná.
        reader = shapefile.Reader(str(shapefile_path), encoding="cp1252")
        source_bbox = rounded(list(reader.bbox))
        for index, record in enumerate(reader.iterShapeRecords()):
            attributes = record.record.as_dict()
            identifier = int(attributes["ECO_ID"])
            geometry = shape(record.shape.__geo_interface__)
            for key, value in polygon_counts(geometry).items():
                source_counts[key] += value
            if not geometry.is_valid:
                repaired_ids.append(identifier)
                geometry = polygon_geometry(polygons(make_valid(geometry)))
            if not geometry.is_valid:
                raise ValueError(f"Source geometry {identifier} could not be repaired")
            auxiliary = identifier == 0
            biome = None if auxiliary else int(attributes["BIOME_NUM"])
            if not auxiliary:
                biome_geometries[biome].append(geometry)
                biome_metadata[biome] = {"name": attributes["BIOME_NAME"],
                                         "color": attributes["COLOR_BIO"]}
            simplified, omitted, before = generalize(
                geometry, args.ecoregion_tolerance, args.ecoregion_min_area)
            after = polygon_counts(simplified)
            quantization_holes_collapsed += max(0, before["holes"] - after["holes"])
            if omitted:
                omissions[str(identifier)] = omitted
            properties = {"id": identifier, "name": attributes["ECO_NAME"], "biome": biome,
                          "biomeName": attributes["BIOME_NAME"],
                          "color": COLOR_UPDATES.get(identifier, attributes["COLOR"]),
                          "biomeColor": attributes["COLOR_BIO"], "realm": attributes["REALM"]}
            if auxiliary:
                properties["auxiliary"] = True
            encoded = feature(identifier, properties, simplified)
            ecoregions.append(encoded)
            if not auxiliary:
                biome_labels[biome].append(Point(encoded["properties"]["label"]))
            if index % 100 == 0:
                print(f"Prepared source record {index + 1}/{len(reader)}", flush=True)

    ids = {f["id"] for f in ecoregions}
    if ids != set(range(847)) or len(ecoregions) != 847:
        raise ValueError("Expected 846 ecoregions (IDs 1–846) and auxiliary Rock and Ice (0)")
    biome_features = []
    biome_omissions = {}
    biome_holes_collapsed = 0
    for biome in sorted(biome_geometries):
        print(f"Dissolving biome {biome}/14", flush=True)
        dissolved = union_all(biome_geometries.pop(biome))
        if not dissolved.is_valid:
            dissolved = make_valid(dissolved)
        dissolved = polygon_geometry(polygons(dissolved))
        simplified, omitted, before = generalize(
            dissolved, args.biome_tolerance, args.biome_min_area, biome_labels[biome])
        biome_holes_collapsed += max(0, before["holes"] - polygon_counts(simplified)["holes"])
        metadata = biome_metadata[biome]
        props = {"id": biome, "biome": biome, "name": metadata["name"],
                 "biomeName": metadata["name"], "color": metadata["color"],
                 "ecoregionCount": sum(f["properties"]["biome"] == biome for f in ecoregions)}
        biome_features.append(feature(biome, props, simplified))
        if omitted:
            biome_omissions[str(biome)] = omitted
    if len(biome_features) != 14:
        raise ValueError("Expected exactly 14 biomes")

    common = {"name": "RESOLVE Ecoregions 2017", "provider": "RESOLVE",
              "license": "CC-BY-4.0", "licenseUrl": LICENSE_URL, "citation": DOI,
              "sourceUrl": SOURCE_URL, "catalogUrl": CATALOG_URL, "producerUrl": PRODUCER_URL,
              "accessed": args.accessed, "sourceSha256": SOURCE_SHA256,
              "sourceArchiveBytes": archive_bytes, "crs": "EPSG:4326",
              "sourceFeatureCount": 847, "ecoregionCount": 846, "biomeCount": 14,
              "auxiliaryFeature": {"id": 0, "name": "Rock and Ice", "biome": None},
              "ringWinding": "clockwise outer rings; counterclockwise holes (d3-geo convention)",
              "coordinatePrecisionDegrees": 0.00001,
              "labelMethod": "point on surface of largest generalized polygon component",
              "cartographicUse": "Generalized world/regional overview, not scientific point attribution",
              "sourceBbox": source_bbox}
    ecoregions.sort(key=lambda f: f["id"])
    outputs = {}
    for filename, features, tolerance, minimum_area in [
        ("world-ecoregions.json", ecoregions, args.ecoregion_tolerance, args.ecoregion_min_area),
        ("world-biomes.json", biome_features, args.biome_tolerance, args.biome_min_area),
    ]:
        bbox = rounded([min(f["bbox"][0] for f in features), min(f["bbox"][1] for f in features),
                        max(f["bbox"][2] for f in features), max(f["bbox"][3] for f in features)])
        data = {"type": "FeatureCollection", "bbox": bbox,
                "source": {**common, "simplificationToleranceDegrees": tolerance,
                           "minimumDisconnectedComponentAreaSquareDegrees": minimum_area},
                "features": features}
        outputs[filename] = {**write_json(args.output / filename, data),
                             "featureCount": len(features), "bbox": bbox,
                             "parts": sum(polygon_counts(shape(f["geometry"]))["parts"] for f in features),
                             "holes": sum(polygon_counts(shape(f["geometry"]))["holes"] for f in features)}
        print(filename, outputs[filename], flush=True)

    report = {"source": common, "sourceCrsWkt": source_crs,
              "sourceEncoding": "Windows-1252 (archive has no .cpg)",
              "sourceGeometryCounts": source_counts,
              "repairedSourceGeometryIds": sorted(repaired_ids),
              "ecoregionOmittedSmallComponentCountsById": omissions,
              "biomeOmittedSmallComponentCountsById": biome_omissions,
              "holesCollapsedByCoordinateGrid": {"ecoregions": quantization_holes_collapsed,
                                                 "biomes": biome_holes_collapsed},
              "catalogColorCorrections": COLOR_UPDATES,
              "parameters": {"ecoregionToleranceDegrees": args.ecoregion_tolerance,
                             "biomeToleranceDegrees": args.biome_tolerance,
                             "ecoregionMinComponentAreaSquareDegrees": args.ecoregion_min_area,
                             "biomeMinComponentAreaSquareDegrees": args.biome_min_area},
              "software": {"pyshp": shapefile.__version__, "shapely": shapely.__version__,
                           "GEOS": shapely.geos_version_string}, "outputs": outputs}
    description = """RESOLVE Ecoregions 2017 — generalized browser vectors

Attribution: RESOLVE Ecoregions 2017, Dinerstein et al. (2017),
An Ecoregion-Based Approach to Protecting Half the Terrestrial Realm,
BioScience 67(6):534–545. https://doi.org/10.1093/biosci/bix014
License: Creative Commons Attribution 4.0 International (CC-BY-4.0).
https://creativecommons.org/licenses/by/4.0/

The public producer site links the exact Google Cloud Storage archive used here.
The official Earth Engine catalog confirms 846 terrestrial ecoregions, 14 biomes,
8 realms, field meanings, license, and eight ecoregion color corrections.

Actual archive: 847 distinct records, IDs 0–846. Biological ecoregion IDs 1–846
are each present exactly once in world-ecoregions.json. ID 0 is auxiliary
“Rock and Ice”, retained for source polar/Greenland coverage with biome:null
and auxiliary:true. Its source BIOME_NUM=11 conflicts with BIOME_NAME=N/A;
it is deliberately excluded from the fourteen dissolved biomes and their counts.
No ice geometry is assigned to Tundra. Antarctic and Arctic coverage is retained
without a Web Mercator latitude clip; the source itself stops short
of the exact poles. No polar cap or other geography is invented.

Transformations:
* Decode original DBF text as Windows-1252 and keep original English names,
  realm names, COLOR and COLOR_BIO; apply the catalog's eight color corrections.
* Repair invalid source polygons with GEOS make_valid; retain polygonal pieces,
  discard collapsed line/point remnants. Source properties are never reassigned.
* For detailed ecoregions, protect the largest component of every source ID,
  omit only disconnected components below the recorded square-degree threshold,
  then use topology-preserving Douglas–Peucker simplification in longitude/latitude.
* For biome overview, dissolve repaired ORIGINAL ecoregions by BIOME_NUM before
  generalization (not the already simplified features). Protect each biome's
  largest component and any component containing a retained ecoregion label.
* Retain holes in surviving polygon components. Coordinate quantization can
  collapse sub-grid rings; resulting counts are reported below. Meaningful lake
  and interior holes remain. Small-part filtering is cartographic generalization,
  not evidence that those islands or habitats are absent.
* Quantize to 0.00001 degrees with GEOS valid_output, use d3 spherical winding
  (clockwise outer rings, counterclockwise holes), retain original antimeridian
  pieces, and subdivide same-piece polar segments to longitude steps <=90°.
* Compute each bbox and an interior label from its generalized geometry.

Limitations: Per-feature simplification preserves each polygon's topology but
does not enforce identical shared edges between different ecoregions or biomes;
small seam gaps/overlaps are possible at the stated tolerances. This is suitable
for world/regional illustration, not cadastral boundaries, area measurement,
current habitat condition, local planning, or scientific point attribution.
The 2017 dataset describes biogeographic ecoregions, not current land cover.

Reproduce using scripts/prepare-ecoregions.py, the pinned archive checksum and
software/parameters below. All output geometries and interior labels are validated.
Source archive is intentionally not bundled; the script downloads it if omitted.

"""
    (args.output / "ecoregions-SOURCES.txt").write_text(
        description + json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
