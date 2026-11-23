# Editable R map quality validation

The R renderer now scales its numeric DEM grid with output size (90% of output width), capped at 16 million cells with an explicit message. The tile count limit follows the website quality profile. Non-wrapped extents merge source DEM tiles before reprojection; wrapped extents retain per-tile reprojection.

Country boundaries use the same shared-edge extraction as the website instead of country polygon outlines. Mercator uses the website spherical Earth radius. Marker radius uses the captured map panel width, with optional co-occurrence sizing. Pie order/orientation, outlines, marker-shaped legend keys, elevation ticks, frame and north arrow have been adjusted.

Validation: actual R runs for a basic map, terrain/bathymetry, a dateline-crossing Equal Earth extent, and a Robinson map with replacement CSV/new taxon. PNG/PDF/SVG outputs verified. Additional Taiwan z7 DEM run at 1800 pixels inspected for terrain detail and coast duplication. Native Canvas and R reference figures use the same input points/settings; they are deliberately retained separately to show remaining differences. Browser preview is not part of these checks.

Remaining differences: automatic legend placement and typography, country label selection, contour labels, fine optional coastal/hydro/ecology layers, and curved-view bounding boxes. This is not a claim of pixel-identical reproduction. Source DEM resolution still limits recoverable detail.
