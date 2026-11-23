# WorldBioTopoMaps v18 small-fix candidate
Date: 2026-11-06 (Asia/Taipei)
Base: 2f530157d21686a49e892cd8a4f220a345c720b4 (v18).
Independent candidate; no deployment or remote push. P0-02 coastline commits are NOT included in this candidate branch. Other work and rescue archives are preserved.

## Changes
- Removed ten selectable symbols: four arrows, heart, teardrop, crescent, hourglass, bowtie, chevron. Added vector question mark: 16 selectable symbols total.
- Imported retired symbols fall back to circle; original observations are preserved.
- Replaced streets option with OpenTopoMap-style topographic tiles from Top-O-Map. Existing osm settings migrate to Original terrain.
- Preserved Original DEM, elevation/depth palettes, shadows, coast assets and geometry logic. Only topographic attribution/status changed in map.mjs.
- Retained tile cache, concurrency limits and pending/failed export blocking. Added local provider logo and attribution to outputs.
- Updated language strings and tests.

## Validation
PASS: markers, street-map, street-controls, i18n, legend-studio, codegen and tests/check.mjs on this v18 candidate.
Includes native Canvas marker/legend rendering, representative PNG/SVG/PDF packaging, R package generation, settings compatibility and export guards.
PASS: git diff --check; protected geometry/assets/DEM modules unchanged from v18.
NOT TESTED: interactive browser QA, running generated code in R, full coastline geographic acceptance.

## Important limitation
Prior live tile check of the same provider integration returned prominent baked-in "for testing purposes only" watermarks. This candidate is for testing; do not treat this basemap as publication-ready. Watermarks have not been removed. Original terrain is unaffected.
Provider: https://top-o-map.com/
Integration/terms: https://top-o-map.com/map-integration.html
Style license: https://creativecommons.org/licenses/by-sa/3.0/
No claim is made that pre-existing v18 coastline defects are fixed.

## Street basemap restoration (2026-11-06)
User requested restoration after reviewing the topographic watermark. Restored v18 OSM street provider, attribution, renderer and multilingual controls. Retained all 16 marker choices including question mark. Imported v19 topo settings now map to osm; existing osm settings remain osm. Original terrain is unchanged. Unused provider source/logo files are retained for history but are no longer loaded.
PASS: markers, street-map (including PNG/SVG/PDF/R bundle packaging), street-controls and i18n; git diff --check. Browser manual QA and R execution not performed.
