# Editable R v4 — CJK export

Chinese text is checked against actual glyph coverage in local font files (face 0, matching sysfonts). Preferred system fonts precede other installed fonts and the showtextdb bundled WQY font. Explicit font_file overrides are supported. Missing coverage stops rendering with instructions. Latin labels retain their requested font category/face.

showtext runs separately inside PNG/PDF/SVG devices. PNG DPI matches the requested output resolution. PDF/SVG text uses glyph outlines, not editable text objects; labels remain editable in the R source/data. font_report.txt records selected paths.

Package generation and export contract tests passed. This environment has no R executable; the R font smoke test and rendered visual comparison were NOT executed. SPTOPO_RUN_R=1 additionally tests Chinese title glyph selection, Latin italic settings, missing custom fonts, and three output devices.

Primary API references: https://systemfonts.r-lib.org/reference/glyph_info.html and https://cran.r-project.org/web/packages/showtext/refman/showtext.html .
