export const BASEMAPS=['terrain','osm'];
export const streetBasemap=s=>s.basemap==='osm';
// Stored preferences are unchanged while the external street map is selected.
export const STREET_PAUSED=['contourInterval','landContours','terrain','hillshade','shadow','direction','angle','terrainQuality','ocean','bathymetry','isobaths','freshwater','countries','countryLabels','provinces','provinceLabels','provinceWidth','legendElevation','legendDepth','legendWater'];
export function effectiveMapSettings(s){
 if(!streetBasemap(s))return s;
 const off=Object.fromEntries(['landContours','coastDetail','terrain','ocean','bathymetry','isobaths','freshwater','countries','countryLabels','provinces','provinceLabels'].map(k=>[k,false]));
 return {...s,...off};
}
export const attributionHeight=s=>streetBasemap(s)||s.coastDetail||s.freshwater?28:0;
