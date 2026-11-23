import {ecologySettings} from './ecology.mjs';
export const BASEMAPS=['terrain','osm'];
export const streetBasemap=s=>s.basemap==='osm';
// Stored preferences are unchanged while the external street map is selected.
export const STREET_PAUSED=['contourInterval','landContours','waterDetail','terrain','hillshade','shadow','direction','angle','terrainQuality','mapScope','ecologyTheme','ecoregions','ocean','bathymetry','isobaths','rivers','lakes','countries','countryLabels','provinces','provinceLabels','provinceWidth','counties','towns','countyLabels','townLabels','legendElevation','legendDepth','legendWater','legendBiomes'];
export function effectiveMapSettings(s){
 if(!streetBasemap(s))return ecologySettings(s);
 const off=Object.fromEntries(['landContours','coastDetail','waterDetail','terrain','ecoregions','ocean','bathymetry','isobaths','rivers','lakes','countries','countryLabels','provinces','provinceLabels','counties','towns','countyLabels','townLabels'].map(k=>[k,false]));
 return {...s,...off,ecologyTheme:'off',projection:'mercator'};
}
export const attributionHeight=s=>streetBasemap(s)?28:(s.coastDetail?28:0)+(s.waterDetail&&(s.rivers||s.lakes)?22:0);
