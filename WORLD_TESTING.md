# WorldBioTopoMaps test site

URL: https://world-biotopo-yc.yuchunhsiao1001.chatgpt.site
Source: `/workspace/sites/world-biotopo-yc`
Reference: 1019 test source at `/workspace/sites/taiwan-biotopo-yc-1019`.

## Try

1. The page opens with 9 synthetic global records, 3 groups and a 0–9000 m elevation legend.
2. Choose Taiwan demo: the Taiwan view and 0–4000 m legend return. Choose Global demo to restore the world.
3. Style → Taiwan and the world offers Auto, Taiwan and World. In Auto, the scale follows the selected land/basemap extent. World stays at 9000 m even when zoomed into Taiwan; Taiwan stays at 4000 m.
4. Quick locations offer the world, continents, western Pacific, Taiwan and offshore islands. Upload WGS84 CSV records to map other locations.
5. Compare 0–4000 m colors between modes: they are unchanged. Higher global elevations receive distinct brown/gray/white colors.
6. Under Style → Taiwan and the world, enable province/state/prefecture boundaries and optional names. Adjust line width; zoom into Japan, China, the USA or another region to see names. Country boundaries are independent. Taiwan uses its county/town layers. The optional bundled dataset loads once on first use and must be ready before export; Reload recovers failures.
7. Export PNG/SVG/PDF or a per-taxon ZIP. All use the active scale. Settings and complete project files retain previous compatibility.

The global z1 overview and Taiwan z8 DEMs are bundled. Other detail requires upstream AWS terrain access. World boundaries are generalized Natural Earth 1:50 million data. Polar extremes and dateline-wrapped extents are not supported. The global overview marks polar areas beyond the basemap’s ±85° cutoff with bilingual hatched bands. Cutoff closures are not drawn as coastline/country boundaries; the missing Antarctic cap is not reconstructed. Demonstration records are synthetic.

`npm test` includes actual Canvas/SVG renders, global DEM loading, 9000/4000 m legends, preserved lowland colors, palette cache switching, local world/Taiwan sea masking and high-resolution exports, plus optional admin-1 loading/retry/readiness, province settings/project compatibility and US/Japan/China bilingual renders, along with the inherited application, data, bilingual and export checks. Browser/device testing remains separate.
