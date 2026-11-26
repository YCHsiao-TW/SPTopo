import {COUNTRY_PRESETS} from './country-presets.mjs';
import {placeName} from './place-names.mjs';
export const OCEAN_REGIONS={northAtlantic:[-85,0,20,80],southAtlantic:[-70,-60,25,0],northPacific:[120,0,-80,65],southPacific:[145,-60,-70,0],indian:[20,-60,120,30],arctic:[-180,65,180,85],southern:[-180,-85,180,-55]};
export const OCEAN_NAMES={northAtlantic:'北大西洋',southAtlantic:'南大西洋',northPacific:'北太平洋',southPacific:'南太平洋',indian:'印度洋',arctic:'北冰洋',southern:'南冰洋'};
export function sortedCountries(language){return COUNTRY_PRESETS.map(c=>({...c,label:placeName(c,language),english:placeName(c,'en')})).sort((a,b)=>a.english.localeCompare(b.english,'en')||a.id.localeCompare(b.id));}
export function populateRegions(select,language,t){
 const current=select.value;select.replaceChildren();const add=(parent,value,label)=>{const option=new Option(label,value);parent.append(option);};
 add(select,'points',t('依目前點位'));add(select,'custom',t('自訂範圍'));add(select,'world',t('全球'));
 const group=label=>{const el=document.createElement('optgroup');el.setAttribute('label',t(label));select.append(el);return el;};
 const continents=group('洲別');for(const [id,label] of [['asia','亞洲'],['europe','歐洲'],['africa','非洲'],['americas','美洲'],['oceania','大洋洲']])add(continents,id,t(label));
 const oceans=group('海域');for(const [id,label] of Object.entries(OCEAN_NAMES))add(oceans,id,t(label));
 const countries=group('國家與地區（英文 A–Z）');for(const c of sortedCountries(language))add(countries,c.id,c.label);
 select.value=Array.from(select.options).some(option=>option.value===current)?current:'world';
}
