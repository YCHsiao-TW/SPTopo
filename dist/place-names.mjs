const locales=new Map();
export function placeName(p,language='en'){
 if(language==='zh-Hant')return p.name_zh_hant||p.zh||p.name_en||p.name;
 if(language==='zh-Hans')return p.name_zh||p.hans||p.name_en||p.name;
 if(p.iso2){try{if(!locales.has(language))locales.set(language,new Intl.DisplayNames([language],{type:'region'}));return locales.get(language).of(p.iso2)||p.name;}catch{}}
 return p.name_en||p.name;
}
