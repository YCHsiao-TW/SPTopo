# Editable R v3 layout update

Exports layout.json with website page, map, independent legend positions and font settings. R uses grid composition, retains projected aspect ratio, and draws separate numeric legends. Source directory detection now precedes config loading. Complete runs have unique timestamped output folders; latest copies are updated after rendering all three formats.

Validation in this revision: JavaScript package generation, customized legend geometry/style serialization, export UI contract, source syntax and existing codegen/i18n checks passed. Native R is unavailable in this environment; downloading an R runtime timed out. The new R layout has NOT been executed or visually verified here. The opt-in SPTOPO_RUN_R=1 suite includes terrain, dateline, replacement records, unique outputs and source-from-stale-directory checks for execution where R is installed.

Remaining differences: installed font metrics, curved projection framing, country labels, contour labels and scale bar styling. Water and biome legends are not replayed by the new page compositor. No screenshot basemap is used.
