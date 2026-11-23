# Geographic data sources

## Taiwan administrative boundaries

Taiwan Atlas 2021.9.20 (`towns-10t.json`), https://github.com/dkaoster/taiwan-atlas . MIT notice retained in `dist/assets/taiwan-atlas-LICENSE.txt`. Original source: Ministry of the Interior, National Land Surveying and Mapping Center, https://data.gov.tw/dataset/7441 , under Open Government Data License v1. Historical coverage includes 22 counties/cities and 368 townships/districts. These detailed geometries are retained for the Taiwan mode and Taiwan land in the world mode.

## Global land and country/region boundaries

Natural Earth Admin 0 Countries, **50m v5.1.1**, retrieved 2026-10-20:

- Source page: https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/
- Archive: https://naciscdn.org/naturalearth/50m/cultural/ne_50m_admin_0_countries.zip
- Archive SHA-256: `5fed433373581fa648920435f937d95f2d3c0200e067409c6478dcdf1b853139`
- License: Public Domain, https://www.naturalearthdata.com/about/terms-of-use/

Made with Natural Earth. The delivered GeoJSON contains 242 country/territory features from this snapshot, not a count of internationally recognized states. WGS84 geometries were clipped to [-180, -85, 180, 85] and simplified with a topology-preserving 0.015-degree tolerance. Country codes, source English/Chinese names and label anchors were retained. A dissolved land mask was generated; its Taiwan geometry uses the existing Taiwan Atlas nation geometry. Country boundary display is separate from coastline display. Dataset names and boundaries follow the source snapshot. “50m” denotes a **1:50 million map scale**, not 50-metre ground resolution; this basemap is generalized and has limited small-island/detail coverage.

## Global province/state/prefecture boundaries and names

Natural Earth Admin 1, original **1:10 million** scale, retrieved 2026-10-20:

- Source: https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/
- Internal boundary lines **5.1.0**: https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces_lines.zip
- Line archive SHA-256: `86acd56ce6c0e47f5fa79725591533b5766f26d6ed1437b086f2b8d4028fe456`
- Names/label anchors from state/province polygons **5.1.1**: https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip
- Polygon archive SHA-256: `efc59726337323058f9446210adc96673179cd344e053666ee3d28cb58ba2b05`
- License: Public Domain, https://www.naturalearthdata.com/about/terms-of-use/

The bundled derivative contains 10,137 internal line features and 4,575 administrative labels across 250 source country/territory codes. These are source dataset categories, not counts of internationally recognized states. Null shapes and Taiwan admin-1 records are omitted; Taiwan retains the existing detailed county/town snapshot. Lines are clipped to longitude ±180°, latitude ±85°, simplified at 0.015 degrees and rounded to five decimal places. English, Traditional Chinese (falling back to source Chinese/original names), source codes, label anchors and bounds are retained. Anchors outside their source polygons are replaced with an interior representative point. The UI avoids label overlaps and omits names when zoomed out or space is insufficient. Source names, boundary definitions and historical administrative arrangements follow Natural Earth and are not automatically updated. Admin-1 linework at this scale may differ slightly from the more generalized 1:50 million country/land base.

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

Maps offer Web Mercator (EPSG:3857), Equal Earth (equal area) and Robinson (compromise); inputs use WGS84 longitude/latitude. The interface accepts extents within longitude −180° to 180° and latitude −85° to 85°. Equal Earth/Robinson support rotated antimeridian clipping and Pacific centering at 150°E. Taiwan mode retains Web Mercator. The source basemap is clipped at latitude ±85°; its synthetic closing edges at this cutoff and the dateline are excluded from coastline/country strokes. Hatched polar bands mark areas beyond source coverage in previews and exports, without fabricating coastline or elevation for the missing polar cap. Scale bars show horizontal distance near the map center; scale/distortion varies with position and projection.

Application demonstration CSVs contain synthetic records, including the global city-coordinate example. They are not evidence of biological occurrence or abundance.


## Water layers
Continuous ocean bathymetry: Mapzen/AWS Terrain Tiles negative elevations, primarily ETOPO1 in ocean areas (DOC/NOAA/NESDIS/NCEI), decoded and colored in-browser. The continuous palette spans 0–11000 m; data/display interpolation does not increase source accuracy. Source documentation: https://github.com/tilezen/joerd/blob/master/docs/data-sources.md .

Ocean mask and optional contours: Natural Earth bathymetry 4.1.0 (derived from SRTM Plus), rivers and lakes 5.0.0, Public Domain, original scale 1:10,000,000. Downloaded 2026-10-21 from the official Natural Earth S3 distribution. Generalized in `scripts/prepare-water.py` and clipped to ±85°; archive hashes are in `dist/assets/water-SOURCES.txt`. Vector contours are generalized source contours; raster depth colors interpolate actual decoded elevations. Lake depths are not included.

- https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-bathymetry/
- https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-rivers-lake-centerlines/
- https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-lakes/
- https://www.naturalearthdata.com/about/terms-of-use/


## Terrestrial biomes and ecoregions

RESOLVE Ecoregions 2017, Dinerstein et al. (2017), *An Ecoregion-Based Approach to Protecting Half the Terrestrial Realm*, BioScience 67(6):534–545, https://doi.org/10.1093/biosci/bix014 . CC BY 4.0, https://creativecommons.org/licenses/by/4.0/ . Official archive: https://storage.googleapis.com/teow2016/Ecoregions2017.zip . Dataset overview: https://ecoregions.appspot.com/ .

The derivative repairs invalid polygons, generalizes detail, removes documented tiny disconnected components while protecting every ecological ID, and dissolves 846 terrestrial ecoregions into 14 biomes. Rock/Ice is retained as an auxiliary record, not a fifteenth biome. Source colors are muted for display and legends. No endorsement is implied. Full source hashes, processing parameters, retained holes and limitations are in `dist/assets/ecoregions-SOURCES.txt`.

## Projection software

D3 Geo 3.1.1, D3 Geo Projection 4.0.0, D3 Array 3.2.4 and InternMap 2.0.3 are included in a local, tree-shaken browser module. ISC license texts and copyright notices are retained in `dist/vendor/geo-LICENSE.txt`. Rebuild instructions with pinned build-tool versions are in that file and `scripts/build-projections.mjs`. No runtime external script dependency is added.


## Optional prepared coastline detail

© OpenStreetMap contributors, Open Database License (ODbL 1.0), https://www.openstreetmap.org/copyright . Source: https://osmdata.openstreetmap.de/data/land-polygons.html , complete unsplit WGS84 coastline-derived land polygons retrieved 2026-11-02. The application derives true coastlines before regional clipping, simplifies geometry, omits documented small islands, repairs invalid geometries and clips to latitude ±85°. The prepared derivative is distributed under ODbL; retain attribution. Full source hash and processing details, together with the upstream README, are in `dist/assets/coast-detail/SOURCES.txt` and `index.json`. No upstream endorsement is implied.

## Optional prepared inland-water detail

RiverATLAS v1, part of HydroATLAS: Linke et al. (2019), *Global hydro-environmental sub-basin and river reach characteristics at high spatial resolution*, Scientific Data 6:283, https://doi.org/10.1038/s41597-019-0300-6 . Official product: https://www.hydrosheds.org/hydroatlas . CC BY 4.0, https://creativecommons.org/licenses/by/4.0/ .

HydroLAKES v1: Messager et al. (2016), *Estimating the volume and age of water stored in global lakes using a geo-statistical approach*, Nature Communications 7:13603, https://doi.org/10.1038/ncomms13603 . Official product: https://www.hydrosheds.org/products/hydrolakes . CC BY 4.0.

Both datasets are modified for browser cartography by filtering, simplifying and assigning features to regional chunks, retaining source IDs where documented, and removing small lake islands at display thresholds. This derivative does not distribute the separately licensed HydroRIVERS standalone data; river geometry is read from the CC-BY RiverATLAS source. Full source hashes, thresholds, transformations and citations are in `dist/assets/hydro-detail/SOURCES.txt` and `index.json`. These are mapped river/lake geometries and cartographic attributes, not measurements of current lake depth or water level. No upstream endorsement is implied.
