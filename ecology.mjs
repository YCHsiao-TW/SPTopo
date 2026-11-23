export const ECOLOGY_SOURCE='RESOLVE Ecoregions 2017 (Dinerstein et al. 2017), CC BY 4.0, https://ecoregions.appspot.com/; 846 terrestrial ecoregions, 14 biomes; cartographically generalized; biome palette muted in browser. Auxiliary Rock and Ice is not a biome. Not marine bioregions or current land cover. Preparation and attribution: assets/ecoregions-SOURCES.txt.';
export const BIOME_NAMES=['','熱帶與亞熱帶濕潤闊葉林','熱帶與亞熱帶乾燥闊葉林','熱帶與亞熱帶針葉林','溫帶闊葉與混合林','溫帶針葉林','北方針葉林／泰加林','熱帶與亞熱帶草原、莽原與疏灌叢','溫帶草原、莽原與疏灌叢','氾濫草原與莽原','山地草原與疏灌叢','凍原','地中海森林、疏林與灌叢','沙漠與乾燥疏灌叢','紅樹林'];
export function ecologySettings(s){return s.ecologyTheme==='biomes'?{...s,terrain:false}:s;}
export function biomeColor(feature){const hex=feature?.properties.color;if(!/^#[0-9a-f]{6}$/i.test(hex||''))return '#e2e2e0';return '#'+[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*.68+255*.32).toString(16).padStart(2,'0')).join('');}
export class EcologyLayers{
 constructor(onChange){this.onChange=onChange;this.layers=new Map();}
 load(key){let layer=this.layers.get(key);if(layer)return layer;layer={state:'loading',data:null};this.layers.set(key,layer);fetch(`./assets/world-${key}.json`).then(r=>{if(!r.ok)throw Error('ecology');return r.json();}).then(data=>{layer.data=data;layer.state='ready';this.onChange();}).catch(()=>{layer.state='error';this.onChange();});return layer;}
 data(key){return this.layers.get(key)?.data;}
 status(s){const keys=[...(s.ecologyTheme==='biomes'?['biomes']:[]),...(s.ecoregions?['ecoregions']:[])],layers=keys.map(k=>this.load(k));return {active:!!keys.length,ready:layers.every(l=>l.state==='ready'),failed:layers.some(l=>l.state==='error')};}
 retry(){for(const [k,v] of this.layers)if(v.state==='error')this.layers.delete(k);this.onChange();}
}
