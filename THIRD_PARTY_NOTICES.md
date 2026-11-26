# Geographic data sources

## Global land and country/region boundaries

Natural Earth Admin 0 Countries, **50m v5.1.1**, retrieved 2026-10-20:

- Source page: https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/
- Archive: https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_countries.zip
- Archive SHA-256: `5fed433373581fa648920435f937d95f2d3c0200e067409c6478dcdf1b853139`
- License: Public Domain, https://www.naturalearthdata.com/about/terms-of-use/

Made with Natural Earth. The delivered GeoJSON contains 242 country/territory features from this snapshot, not a count of internationally recognized states. WGS84 geometries were clipped to [-180, -85, 180, 85] and simplified with a topology-preserving 0.015-degree tolerance. Country codes, source English/Chinese names and label anchors were retained. The generalized world land mask uses dissolved Natural Earth country geometry. Country boundary display is separate from coastline display. Dataset names and boundaries follow the source snapshot. “50m” denotes a **1:50 million map scale**, not 50-metre ground resolution; this basemap is generalized and has limited small-island/detail coverage.

## Global province/state/prefecture boundaries and names

Natural Earth Admin 1, original **1:10 million** scale, retrieved 2026-10-20:

- Source: https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/
- Internal boundary lines **5.1.0**: https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces_lines.zip
- Line archive SHA-256: `86acd56ce6c0e47f5fa79725591533b5766f26d6ed1437b086f2b8d4028fe456`
- Names/label anchors from state/province polygons **5.1.1**: https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip
- Polygon archive SHA-256: `efc59726337323058f9446210adc96673179cd344e053666ee3d28cb58ba2b05`
- License: Public Domain, https://www.naturalearthdata.com/about/terms-of-use/

The bundled derivative contains 10,178 internal line features and 4,596 administrative labels across 251 source country/territory codes. These are source dataset categories, not counts of internationally recognized states. Null shapes are omitted. Coverage varies by region and follows the Natural Earth release. Lines are clipped to longitude ±180°, latitude ±85°, simplified at 0.015 degrees and rounded to five decimal places. English, Traditional Chinese (falling back to source Chinese/original names), source codes, label anchors and bounds are retained. Anchors outside their source polygons are replaced with an interior representative point. The UI avoids label overlaps and omits names when zoomed out or space is insufficient. Source names, boundary definitions and historical administrative arrangements follow Natural Earth and are not automatically updated. Admin-1 linework at this scale may differ slightly from the more generalized 1:50 million country/land base.

## Terrain

Mapzen / Tilezen Terrain Tiles, Terrarium format: https://registry.opendata.aws/terrain-tiles/ . Bundled Taiwan z8 tiles retrieved 2026-10-19; four global z1 tiles retrieved 2026-10-20. Higher-detail world terrain is requested from the upstream service as needed. Full provider attribution: https://github.com/tilezen/joerd/blob/master/docs/attribution.md .

SRTM and GMTED2010 data courtesy of the US Geological Survey. ETOPO1 data courtesy of DOC/NOAA/NESDIS/NCEI. The application decodes elevation and computes hypsometric tint and hillshade; these modifications are not upstream endorsements. Higher tile zoom or more export pixels do not imply increased source measurement accuracy. Additional providers retain their own terms.

## OpenStreetMap Standard street basemap

© OpenStreetMap contributors. OpenStreetMap data is available under the Open Database License (ODbL): https://www.openstreetmap.org/copyright . The Standard map is served by the OpenStreetMap Foundation at https://tile.openstreetmap.org/{z}/{x}/{y}.png . Its labels, road/path coverage and cartographic style follow the source service; this application adds occurrence symbols and other map annotations. No endorsement is implied.

The application requests only current-view tiles and honors normal browser caching, without prefetching, bulk collection or offline tile packages. PNG/SVG/PDF exports and the R workflow contain a static produced map of that view, with visible attribution and the full copyright URL. R's standalone basemap image also retains attribution. More output pixels do not increase the tile source's detail. The public tile service is best-effort and usage must comply with its policy; a higher-traffic deployment may require a separately hosted or contracted tile service.

- OSM Standard tile policy: https://operations.osmfoundation.org/policies/tiles/
- OSMF attribution guidelines: https://osmfoundation.org/wiki/Licence/Attribution_Guidelines
- OSMF legal FAQ (including static maps/produced works): https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ

## Map projection and example records

Maps offer Web Mercator (EPSG:3857), Equal Earth (equal area) and Robinson (compromise); inputs use WGS84 longitude/latitude. The interface accepts extents within longitude −180° to 180° and latitude −85° to 85°. Equal Earth/Robinson support rotated antimeridian clipping and Pacific centering at 150°E. The source basemap is clipped at latitude ±85°; its synthetic closing edges at this cutoff and the dateline are excluded from coastline/country strokes. Hatched polar bands mark areas beyond source coverage in previews and exports, without fabricating coastline or elevation for the missing polar cap. Scale bars show horizontal distance near the map center; scale/distortion varies with position and projection.

Application demonstration CSVs contain synthetic records, including the global city-coordinate example. They are not evidence of biological occurrence or abundance.


## Water layers
Continuous ocean bathymetry: Mapzen/AWS Terrain Tiles negative elevations, primarily ETOPO1 in ocean areas (DOC/NOAA/NESDIS/NCEI), decoded and colored in-browser. The continuous palette spans 0–11000 m; data/display interpolation does not increase source accuracy. Source documentation: https://github.com/tilezen/joerd/blob/master/docs/data-sources.md .

Ocean mask and optional contours: Natural Earth bathymetry 4.1.0 (derived from SRTM Plus), Public Domain, original scale 1:10,000,000. Downloaded 2026-10-21 from the official Natural Earth S3 distribution. Generalized in `scripts/prepare-water.py` and clipped to ±85°; archive hashes are in `dist/assets/water-SOURCES.txt`. Vector contours are generalized source contours; raster depth colors interpolate actual decoded elevations. Lake depths are not included.

- https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-bathymetry/
- https://www.naturalearthdata.com/about/terms-of-use/


## Projection software

D3 Geo 3.1.1, D3 Geo Projection 4.0.0, D3 Array 3.2.4 and InternMap 2.0.3 are included in a local, tree-shaken browser module. ISC license texts and copyright notices are retained in `dist/vendor/geo-LICENSE.txt`. Rebuild instructions with pinned build-tool versions are in that file and `scripts/build-projections.mjs`. No runtime external script dependency is added.


## Optional prepared coastline detail

© OpenStreetMap contributors, Open Database License (ODbL 1.0), https://www.openstreetmap.org/copyright . Source: https://osmdata.openstreetmap.de/data/land-polygons.html , complete unsplit WGS84 coastline-derived land polygons retrieved 2026-11-02. The application derives true coastlines before regional clipping, simplifies geometry, omits documented small islands, repairs invalid geometries and clips to latitude ±85°. The prepared derivative is distributed under ODbL; retain attribution. Full source hash and processing details, together with the upstream README, are in `dist/assets/coast-detail/SOURCES.txt` and `index.json`. No upstream endorsement is implied.

## Freshwater

© OpenStreetMap contributors. The Overture Maps `2026-11-18.0` base/water release supplies the OSM-derived river, stream, lake and reservoir data. The tile build joins compatible centerlines, ranks connected channels, filters and simplifies geometry, and removes centerline parts coincident with visible water areas. The same rules apply worldwide. The atlas covers 85°S to 85°N. OSM survey completeness and geometry vary by region.

The freshwater database and editable R vectors are distributed under the ODbL 1.0. The website software has a separate licence. Retain the OSM attribution when publishing maps and follow the ODbL terms when redistributing the geographic database.

- https://www.openstreetmap.org/copyright
- https://opendatacommons.org/licenses/odbl/1-0/
- https://docs.overturemaps.org/schema/reference/base/water/

Build from the pinned water partition with Python, DuckDB 2.0.1 and its `spatial` and `httpfs` extensions, Shapely 2.2, NumPy and PyArrow. The scripts record source-object ETags and output receipts. Reuse the same output paths to resume a build.

```sh
python scripts/extract-osm-freshwater.py water-staging
python scripts/prepare-osm-freshwater.py water-staging freshwater-prepared
python scripts/package-freshwater-tiles.py freshwater-prepared freshwater-output
```

Copy the public index, overview, tiles, statistics, source metadata, ODbL licence and `distribution.json` into `dist/assets/freshwater`. The hidden `.strips` directory holds resumable build receipts. The overview and continental files use gzip-compressed TopoJSON. Other tiers encode the same topology with gzip-compressed variable-length integers. The regional tier retains its coordinates. The finer two tiers use a 0.0002° and 0.0001° grid respectively, retaining original coordinates where snapping would invalidate a polygon or collapse an arc. The two finest tiers omit transient feature identifiers and reach counts while retaining names and styles. The level-of-detail thresholds are 3, 5.7, 9.25 and 11.8 in logical map zoom. Minimum lake and reservoir areas are 220, 18, 0.75, 0.085 and 0.012 km². For the continental tier, global rivers and a locally selected regional channel are retained. Finer tiers use adjusted spatial density limits. Original OSM mapping gaps remain visible.
