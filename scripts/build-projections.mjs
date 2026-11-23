// Build-only dependencies. The published application uses this local bundle.
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const root=new URL('../',import.meta.url),require=createRequire(new URL('qa/projection-build/package.json',root));
const {build}=require('esbuild');
mkdirSync(new URL('dist/vendor',root),{recursive:true});
await build({stdin:{contents:"export {geoEqualEarth,geoPath,geoGraticule,geoCircle,geoDistance} from 'd3-geo'; export {geoRobinson} from 'd3-geo-projection';",resolveDir:new URL('qa/projection-build',root).pathname},bundle:true,format:'esm',minify:true,outfile:new URL('dist/vendor/geo.mjs',root).pathname});
writeFileSync(new URL('dist/vendor/geo-LICENSE.txt',root),'d3-geo 3.1.1; d3-geo-projection 4.0.0; d3-array 3.2.4; internmap 2.0.3.\nBuilt with esbuild 0.25.12.\nRebuild: npm install --prefix qa/projection-build --no-save --package-lock=false --ignore-scripts d3-geo@3.1.1 d3-geo-projection@4.0.0 esbuild@0.25.12 && node scripts/build-projections.mjs\n\n'+['d3-geo','d3-geo-projection','d3-array','internmap'].map(name=>name+'\n'+readFileSync(new URL('qa/projection-build/node_modules/'+name+'/LICENSE',root),'utf8')).join('\n\n'));
