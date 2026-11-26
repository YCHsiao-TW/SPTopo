import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {WORLD_REGIONS,coordinateLabel} from '../dist/world.mjs';
import {defaultCamera,layout,terrainPlan,Terrain} from '../dist/map.mjs';
import {parseCSV,normalizeRows,dataBounds} from '../dist/core.mjs';
const settings={legend:true},p=layout(settings);
assert.deepEqual(defaultCamera(settings),defaultCamera(settings,WORLD_REGIONS.world));
for(const b of Object.values(WORLD_REGIONS)){assert.ok(b[0]>=-180&&b[2]<=180&&b[1]>=-85&&b[3]<=85&&b[0]!==b[2]&&b[1]<b[3]);const camera=defaultCamera(settings,b);assert.ok(Number.isFinite(camera.zoom));}
for(const quality of ['fast','auto','detail','maximum']){const camera=defaultCamera(settings,WORLD_REGIONS.world),plan=terrainPlan({terrainQuality:quality},camera);assert.ok(plan.zoom>=0&&plan.zoom<=4);const result=Terrain.prototype.visible.call({request:key=>({key})},camera,p,plan.zoom,plan.limit);assert.ok(result.tiles.length>0&&result.tiles.length<=plan.limit);assert.ok(result.tiles.every(t=>t.key.split('/').every(x=>Number(x)>=0)));}
const raw=parseCSV('longitude,latitude,species\n151.21,-33.87,A\n-74.01,40.71,B\n178.45,-18.14,A\n-171.75,-13.83,B'),points=normalizeRows(raw,{lon:'longitude',lat:'latitude',group:'species'}).valid;assert.equal(points.length,4);assert.ok(dataBounds(points)[0]>150&&dataBounds(points)[2]<-73&&dataBounds(points)[0]>dataBounds(points)[2]);
assert.equal(coordinateLabel(-74,-33),'74.00000° W / 33.00000° S');
const world=JSON.parse(await fs.readFile(new URL('../dist/assets/world-countries.geojson',import.meta.url),'utf8'));assert.equal(world.features.length,242);assert.ok(world.land.features.length);for(const iso of ['USA','JPN','AUS','ZAF','FRA','TWN'])assert.ok(world.features.some(f=>f.properties.iso===iso));
console.log('PASS: world/continent presets, southern/western/dateline records, coordinate labels, bounded global DEM requests and bundled country/land geometry');
