# SPTopo

Browser-based mapping of biological occurrence records worldwide. SPTopo runs as a static site with HTML, CSS and JavaScript. CSV records stay in browser memory.

## Use SPTopo online

[Open the SPTopo web app](https://ychsiao-tw.github.io/SPTopo/)

Import a UTF-8 CSV with longitude and latitude columns. Add an optional species or group column to style records by group. Choose a basemap and layers, customize the symbols and legend, and export the map as PNG, SVG, or PDF. Download the editable R package to reproduce and revise the map in R.

To run SPTopo locally, run `python3 -m http.server 8000 --directory dist` from the repository root and open http://localhost:8000/.

## Mapping

- Country labels avoid the full text rectangle intersecting Natural Earth 1:10m breakaway/disputed polygons (v5.1.1), with a 2 px clearance. Labels relocate within visible country geometry or are omitted if no candidate fits. This applies in every language and export; it does not change boundaries, occurrence records or quick-location names. Lease and overlay-only features are excluded from the suppression mask. Source coverage is version-dependent, not a guarantee of all current disputes. Rebuild the pinned source with `python scripts/import-disputed-areas.py`.


- **Draw map frame:** choose the rectangle-selection button under aspect ratio, drag across the map and apply. The selected geographic area and page aspect update together; cancel leaves the map unchanged.
- Ocean fill uses the active land geometry as its complement, and country borders use shared interior edges so a separate country coastline is not drawn over the basemap coast.


- The basemap selector adds OpenStreetMap Standard streets and paths alongside the original terrain/ocean map. Street mode keeps the selected projection and temporarily pauses terrain, water and administrative overlays. Switching back restores those layer preferences. Occurrence symbols, legends, graticule, frame, north arrow and scale bar remain available.
- Quick location groups: current records and custom bounds first, then the world, five continents, seven ocean regions and 242 source countries/territories sorted by English name. Ocean-region presets provide overview extents. Map projection is available directly in the layer settings. Choose Web Mercator (default), Equal Earth (equal area) or Robinson (compromise).
- World country boundaries and bilingual country/region labels; optional province/state/prefecture boundaries and names, with adjustable line width. Traditional Chinese names are converted from source Chinese using OpenCC s2twp. Country label placement and size follow the visible country polygon, avoid collisions and prioritize smaller countries.
- Elevation colors and legends span **0–9000 m** worldwide. Low elevations retain their detailed colors, with muted brown and gray grading to white at higher elevations.
- Optional marine layers: pale ocean fill, continuous blue bathymetry from decoded Mapzen/ETOPO1 pixel elevations (0–11000 m palette), and independent isobaths. The Natural Earth isobath vectors load only when isobaths are enabled. One freshwater switch displays rivers, lakes and reservoirs with automatic detail for the map scale. Marine/freshwater demonstration buttons replace the current data and view with explicit synthetic examples.
- The site opens with synthetic global example records and offers downloadable example CSV files.
- UTF-8 CSV import, automatic/manual column mapping, invalid-row reports, editable group colors and taxon filters.
- 25 per-taxon marker silhouettes (including polygons, directional triangles/arrows, stars, crosses, heart, teardrop, crescent, hourglass, bow tie and chevron), with automatic symbol assignment and matching legends/exports, provide a visual cue beyond color. Multi-taxon co-occurrence pies stay circular. Symbols persist in settings/projects; older settings default to circles.
- Presence/count co-occurrence pies, decimal coordinate merging with ties-to-even rounding, stable optional site IDs and reference tables.
- Client-side hillshade, four DEM quality modes, drag/keyboard navigation, zoom and fit-to-record controls.
- Language selector for Traditional/Simplified Chinese, English, Spanish, French, German, Japanese, Korean, Russian, Arabic and Hindi. Translation covers application menus, all symbol names, layer/layout/export options, legend editor, chart controls and annotations, help/source explanations, placeholders, accessible labels, metadata descriptions, validation errors and dynamic progress messages. Arabic enables right-to-left controls while map/chart axes retain their orientation. Taxon names, source columns, filenames, source-data place names and attribution names remain as supplied. Standard formats, units and technical identifiers such as CSV, DEM and EPSG retain their usual notation. Dictionaries are bundled with no translation API calls or runtime dependency.

Projection translations are maintained in `dist/locale-world.mjs`, and street-map copy in `dist/locale-basemap.mjs`, with the same complete-language coverage checks. Additional-language copy is maintained in `scripts/locale-keys.json` and `scripts/locale-additions.tsv` (fixed columns: index, es, fr, de, ja, ko, ru, ar, hi). Run `node scripts/build-locales.mjs` after edits to generate `dist/locale-extended.mjs`. The coverage test requires every application string/template in every language dictionary and identical interpolation placeholders; new untranslated copy fails the check. Simplified Chinese is a generated Traditional-to-Simplified conversion dictionary. Translation coverage does not replace review of terminology by native speakers. Geographic labels follow the source dataset’s available names rather than translating research data.

## Coastline and freshwater

The terrain basemap uses prepared OpenStreetMap coastline-derived polygons and separate coastline lines. Coast processing and coverage are documented in `dist/assets/coast-detail/SOURCES.txt`.

**Rivers, lakes and reservoirs** uses OpenStreetMap from the Overture Maps `2026-11-18.0` base/water release. Regional and local views add smaller rivers, lakes, reservoirs and streams automatically. Seasonal waterways appear only at detailed scales. Regional layers cover the globe. The finest tier covers the Taiwan Strait, Japan and the Ryukyu Islands, the Philippines, and the Korean Peninsula. Other regions use regional detail. Freshwater coverage and mapping quality vary.

The site fetches preprocessed files for the current map view. The freshwater setting controls both the map and its legend. PNG, SVG, PDF and the editable R ZIP use the same data and level of detail. The R ZIP records the data version and includes the selected vectors, styles and attribution. Export a new ZIP after changing the geographic extent or projection.

The prepared freshwater database is distributed under ODbL 1.0. See [Third-party notices](THIRD_PARTY_NOTICES.md) for the sources and build instructions.

## OpenStreetMap streets and paths

OSM Standard tiles load directly from `https://tile.openstreetmap.org/{z}/{x}/{y}.png` for the current viewport only, with at most four simultaneous requests and 64 tiles per view. The world view starts at source zoom 3 for country and region labels. Unstarted requests for an old view are discarded; dragging does not initiate tile requests. Normal browser HTTP caching is retained, with a bounded cache of decoded images. The browser sends its normal User-Agent and the site-origin Referer. There is no proxy, cache-busting, prefetch or offline tile archive. Failed or CORS-incompatible tiles block the required export and can be retried using Reload.

PNG, SVG, PDF and the street R package reuse already-viewed tiles at the same zoom; increasing export size does not fetch more detailed tiles. The street R package reproduces the fixed view at the chosen projection and extent and lets R redraw the symbols and legends. To change the projection or extent, export a new ZIP from the site. Visible attribution and the full copyright URL are retained in all outputs, including `basemap.png` and R output with legends disabled. The footer reserves space for attribution independently of the legend controls. Map names and the street style follow OSM; application-language changes do not translate those raster labels. OSM requires internet access and the upstream public tile service has no availability guarantee. See `THIRD_PARTY_NOTICES.md` for source and policy links.

## Elevation distributions

The Elevation distribution tab follows the selected taxa and retains the same colors, symbols and display-name aliases. It draws minimum–maximum whiskers, Q1–Q3 boxes (R type-7 quantiles), median markers, jittered values and sample sizes. Choose a meters-valued original CSV elevation column, explicit DEM estimates, or CSV-first filling of missing values. Zero and negative elevations are valid; blank, nonnumeric or values outside −12000 to 10000 m are missing. These are elevation values, not inferred water depth.

DEM sampling runs only on request for selected coordinates using Mapzen/AWS Terrarium pixels at **fixed zoom 12**, independently of the visible map zoom. Up to four tiles load concurrently; exact coordinate results are cached in settings/projects. Source measurements and vertical accuracy vary geographically; pixel grid spacing does not establish vertical accuracy. Missing/failed estimates remain missing and can be retried; source CSV elevations are retained. Comparison CSV includes original, DEM and original-minus-DEM values. No CSV file is uploaded; online sampling requests the required upstream tile URLs.

The default statistical unit merges the same taxon at exactly the same longitude/latitude and uses the median if that site has multiple elevation values. Alternatively count every eligible record. This is separate from rounded map co-occurrence grouping. Custom elevation-band boundaries/labels are visual background aids, not universal vegetation zones. Synthetic elevation-demo data is clearly marked. PNG, editable SVG and raster PDF chart exports use the export panel's image width; comparison and statistical-summary CSVs are available separately. Large datasets subsample displayed jitter points above 6000 eligible values; statistics still use all eligible values. Analysis settings and DEM cache persist in settings and complete projects.

## R map reproduction

Download the editable ZIP from the **Map R code** tab, extract it, then run `Rscript install_packages.R` once and `Rscript map.R` to render. The package includes selected WGS84 records, taxon styles, palettes and geographic files.

Edit `config.json` for map extent, projection and layers. Set `allow_download` to `false` to use local files only and `coast_detail` to `false` for the bundled Natural Earth land mask. Save edited CSV files as UTF-8. PNG, PDF and SVG are written to a new output directory with source and session information. PDF and SVG require Cairo. See `SOURCES.txt` and `export_notes.json` for data credits and differences from browser rendering.

## Layout and export

Select a passage in a taxon display name in Legend Studio to make that passage italic or upright. Formatting is saved with settings and projects and follows map and R exports.

Nine page-aspect presets, custom physical dimensions and orientation swapping. Taxon, elevation, depth and freshwater legends have independent switches and draggable positions. Click a legend or the Legend studio button to edit its title, serif/sans/monospace font, text/title sizes, bold/italic styles, text color, background and border. Taxon legends also support columns, row spacing, symbol size and display-name aliases; source records, grouping and site tables retain the original taxon names. Color-bar height is adjustable. Arrow keys nudge each focused legend; Shift moves faster. The floating editor is never exported. Seven original layout presets and sidebar controls remain available. PNG, SVG and PDF use the same render and elevation scale as the preview. SVG keeps vector text, boundaries, markers, contours and river/lake layers with embedded raster land/ocean terrain. PDF embeds a raster image. Per-taxon ZIPs retain one extent, colors and shared selected-taxon legend, with reference CSVs and source notes.

Complete `.tbm.json` projects retain all CSV rows, colors, symbols, legend edits/display names, filters, language, camera, layout and export options. Settings-only JSON is also supported. The existing TaiwanBioTopoMaps configuration/project identifiers remain compatible with previous files.

## Maps across the antimeridian

Web Mercator pans continuously across ±180°. For a custom crossing, enter a western longitude greater than the eastern longitude (e.g. west 165°, east −145°). Fit to points chooses the shortest longitude interval; original CSV coordinates remain unchanged. Tile caches use canonical coordinates, and map layers, site counts, coordinate labels and PNG/SVG/PDF/R output share the wrapped view. At global zoom the map displays at most one world. Dataset coverage and local coastline accuracy remain unchanged.

## Data and limits

Natural Earth Admin 0 Countries 5.1.1 at 1:50 million scale provides generalized land and country boundaries. Natural Earth Admin 1 provides first-level administrative boundaries (5.1.0) and names (5.1.1) worldwide. Coverage follows the source release. The optional Admin 1 layer loads when boundaries or names are enabled. Exports that need the layer become available after loading. Terrain uses Mapzen/AWS Terrarium tiles. Global overview and regional cache tiles are bundled. Other tiles load as needed. `prepare_world_assets.mjs` refreshes the global overview and `prepare_assets.py` refreshes the regional cache.

Continuous ocean bathymetry decodes negative elevations in Mapzen/AWS Terrarium tiles (ocean areas primarily use ETOPO1), then interpolates colors between depth stops instead of filling contour bands. Its legend uses the same continuous 0–11000 m palette. Land and ocean reuse the source pixels, with independent bounded color caches. Ocean tile zoom is capped at z8 to avoid implying extra source detail. Pending or failed ocean tiles block required exports even when land elevation is disabled; Reload retries failures. Ocean terrain is embedded raster in SVG, while text, contours, rivers and lakes remain vectors. Bilinear display interpolation and more export pixels do not increase measurement accuracy.

The ocean mask follows the active land geometry. Natural Earth 4.1.0 supplies the optional generalized SRTM Plus contours. All are Public Domain, originally at 1:10,000,000, simplified and bundled. Lake fill uses the previously selected darker ocean blue uniformly and does not imply lake depth. Ocean fill is implied by bathymetry/contours. These are global/regional cartographic layers, not local hydrographic or navigation data. Sea temperature, salinity, tides and currents are not provided. `scripts/prepare-water.py <extracted-source-directory>` rebuilds vector assets using pyshp/shapely; source hashes and transformations are in `dist/assets/water-SOURCES.txt`. Marine demo opens with contours off so the continuous surface is visible.

Inputs are WGS84 longitude/latitude; data and extents accept longitude −180° to 180° and latitude −85° to 85°. Web Mercator (EPSG:3857) remains the default. Equal Earth and Robinson use a vendored, tree-shaken D3 bundle; source licenses and pinned rebuild commands are in `dist/vendor/geo-LICENSE.txt` and `scripts/build-projections.mjs`. The selected projection is shared by the street basemap, terrain, ocean, boundaries, freshwater vectors, markers, graticules and exports. The geographic camera persists in settings and projects, including central meridians in older saved maps. Pan and zoom retain geographic anchors; moves beyond the projection domain are bounded.

Projected land/ocean rasters inverse-map output pixels into the Terrarium source grid with bilinear color sampling and a bounded tile halo. Interactive drag uses a smaller raster; export uses a maximum 2000-pixel-wide/2-million-pixel reprojected terrain layer. This bounds memory and does not increase DEM accuracy. Export checks required source tiles and blocks incomplete terrain. Curved graticules and all vector geometry are clipped at the rotated antimeridian and map viewport. Scale bars represent the horizontal scale near the map center, not uniform scale across the globe; all projections have distortion. The Natural Earth and DEM basemap still ends at ±85°: hatched caps mark missing coverage and synthetic closing edges are omitted from coastline/country strokes. No polar coast or elevation is reconstructed.

Small islands and local boundaries remain limited by generalized data. More output pixels do not add measurement detail. WorldClim, productivity and SDM layers are not part of this version.

## Validation

Run `npm test`. Native Canvas rendering uses `@napi-rs/canvas` from `CODEX_PRIMARY_RUNTIME_NODE_MODULES`. Tests cover data handling, language dictionaries and direction, real application events, configuration/project compatibility, world/continent rendering, bundled global and regional DEMs, PNG/SVG/PDF/ZIP export, terrain seams, a consistent 0–9000 m legend and land/ocean masks in zoomed views, optional admin-1 loading/retry/readiness, province settings compatibility and US/Japan/China bilingual renders. Water checks cover source versions/classes, ocean masking, lazy readiness/failures/retry, bilingual depth legends, freshwater toggles and vector/raster exports. Elevation analysis checks cover source choice, missing/zero values, deduplication, quantiles, fixed-grid sampling/cache/failures/cancellation, rendering/exports, and analysis/project round-trips. Projection checks cover both spherical projections, inverse coordinates, Pacific seams, anchored navigation, geographically located DEM pixel colors, source metadata, compatibility and project persistence. QA renders are written to ignored `qa/`.

These checks cover app events and native rendering; live browser layout, phone interaction and all upstream zoom/location combinations are not exhaustively tested.

Street-map tests cover current-viewport planning, bounded concurrency/cache, stale-queue cancellation, explicit retries, CORS rejection, saved-preference restoration, legacy projects, legend-editor switching, projected point placement and attributed PNG/SVG/PDF/R exports without extra export downloads. Synthetic tile fixtures avoid automated bulk requests. A single live OSM tile was checked for successful loading, CORS and cache headers during integration. The generated street-map R package was also run with the local R/Cairo test runner. The test site was checked in the browser at world, continental, country and local scales.

Detail checks cover real OSM land at the reported Kinmen coordinate, Taiwan river/lake coverage, Great Lakes geometry, Pacific-centered Equal Earth/Robinson, same-source land/ocean masks, source credits with legends off, bounded regional files, current-region retries/caching, backward-compatible settings, image/R-package generation and export-size invariance. New-layer tests use both controlled geometry fixtures and the prepared source assets. Browser checks on the test site also verified the freshwater switch and marine layer controls.

The rectangular Mercator view fills the map frame and limits vertical panning and zoom-out to 85° N–85° S, avoiding out-of-coverage bands.

New maps start with pale-blue ocean fill and first-level administrative boundaries disabled.

### Land contours

Style → Advanced terrain settings includes an independent land-contour switch (off by default) and 100/200/250/500/1000 m intervals. Contours use the current Terrain Tiles DEM, bilinear sampling and marching squares, clipped to the selected land mask. Elevation labels (metres) appear on sufficiently long contours, prioritizing index contours and avoiding nearby labels and sample points. Labels use plain grey text without halos and sparse placement. The same logical geometry is used in the preview, PNG/PDF and vector SVG, and included in the R basemap. DEM coverage is limited to approximately 85° S–85° N; sampling and source resolution limit detail. Settings and projects preserve both controls; legacy files default to off. OSM pauses these overlays without discarding preferences.

## License

SPTopo's original source code and R map templates are licensed under the [MIT License](LICENSE). Third-party software, fonts, and geospatial datasets remain subject to their respective licenses and attribution requirements. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
