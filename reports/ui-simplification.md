# Interface simplification — 2026-11-06
Base: ff77e93562acf1db2e75928809f9f357f8b1329a (v21).
Changes: separate data selection from species styling; contextual help topics; advanced data/terrain/point/legend/project controls; remove promotional headings; independent desktop panel scrolling; combined width/height export labels; localized new labels in all supported languages.
Preserved: renderer, projections, DEM, coastline assets, CSV normalization, R bundle, export algorithms and settings values. Alaska clipping remains outside this change.
PASS: ui-selection, caption, caption-controls, street-controls, world-controls, detail-controls, legend-studio, i18n, export; node syntax and git diff --check.
Browser QA: data and style separation, contextual question-mark help, export dimensions, collapsed project controls, desktop layout.
Limitations: narrow/mobile layout retains the existing stacked responsive layout; not separately browser-tested. No new geographic accuracy claim. Original data tables and advanced controls remain accessible rather than deleting their functions.
Rollback: previous pushed commit above.
