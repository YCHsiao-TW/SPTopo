import assert from 'node:assert/strict';
import fs from 'node:fs';
import {t,tx,setLanguage,getLanguage,readLanguage,applyLanguage,TEXT,MESSAGES,STATIC_COPY} from '../dist/i18n.mjs';
import {LANGUAGES,LOCALE_TEXT} from '../dist/locale-core.mjs';
import {ZH_HANS} from '../dist/zh-hans.mjs';

const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
assert.equal(readLanguage(storage),'zh-Hant');setLanguage('en',storage);assert.equal(readLanguage(storage),'en');assert.equal(getLanguage(),'en');
const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
assert.equal(readLanguage(blocked),'zh-Hant');assert.doesNotThrow(()=>setLanguage('en',blocked));
assert.equal(t('匯出地圖'),'Export map');assert.equal(t('來源列'),'Source row');assert.equal(tx('color',{group:'泉字雲斑蛛'}),'Color for 泉字雲斑蛛');
assert.equal(t('缺少座標'),'Missing coordinates');assert.ok(t('第 9 列欄位數與標題不同；含逗號的文字需加雙引號。').startsWith('Row 9'));
assert.equal(t('海拔 4/5 · DEM z8（依範圍調整） · 1 張載入失敗'),'Elevation 4/5 · DEM z8 (adjusted to extent) · 1 failed');
assert.ok(t('圖檔為 5906 × 23624 px，請降低匯出寬度後再試。').includes('5906 × 23624'));
assert.ok(!/[\u3400-\u9fff]/.test(tx('precision',{lat:'23.5',east:'1.02 m',north:'1.11 m'})));

// A minimal DOM fixture checks reversible copy updates while excluding user content.
const node=(text,excluded=false)=>({nodeValue:text,parentElement:{closest:()=>excluded?{}:null}});
const nodes=[node(' 使用說明 '),node('畫面比例'),node('物種／分群',true),node('來源列',true),node('MAP STUDIO')];
const attrs={'aria-label':'地圖設定',placeholder:'留空使用預設標題'};const element={closest:()=>null,hasAttribute:k=>k in attrs,getAttribute:k=>attrs[k],setAttribute:(k,v)=>attrs[k]=v};
const button={textContent:'EN',setAttribute(){}},meta={content:''};
const doc={documentElement:{lang:''},body:{},createTreeWalker(){let i=0;return {nextNode:()=>nodes[i++]||null};},querySelectorAll:()=>[element],querySelector:()=>meta,getElementById:()=>button};
applyLanguage(doc);assert.equal(doc.documentElement.lang,'en');assert.equal(nodes[0].nodeValue,' Help ');assert.equal(nodes[1].nodeValue,'Page aspect ratio');assert.equal(nodes[2].nodeValue,'物種／分群');assert.equal(nodes[3].nodeValue,'來源列');assert.equal(attrs['aria-label'],'Map settings');assert.equal(button.textContent,'中文');
setLanguage('zh-Hant',storage);applyLanguage(doc);assert.equal(nodes[0].nodeValue,' 使用說明 ');assert.equal(nodes[1].nodeValue,'畫面比例');assert.equal(attrs['aria-label'],'地圖設定');assert.equal(button.textContent,'EN');

const html=fs.readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
assert.match(html,/<span id="languageLabel" data-user-content lang="en">🌐 Language<\/span>/,'Language discovery label stays recognizable in every UI language');
assert.match(html,/<label[^>]*for="languageSelect"/);assert.match(html,/id="languageSelect" aria-labelledby="languageLabel"/);
const translatableHtml=html.replace(/<ul data-user-content>[\s\S]*?<\/ul>/,'').replace(/<p class="author-links" data-user-content>[\s\S]*?<\/p>/,'').replace(/<span id="languageLabel"[^>]*>[\s\S]*?<\/span>/,'').replace(/<select[^>]*id="languageSelect"[\s\S]*?<\/select>/,'');
const copy=[...translatableHtml.matchAll(/>([^<>]*[\u3400-\u9fff][^<>]*)</g)].map(m=>m[1].trim());
const attributes=[...html.matchAll(/(?:aria-label|title|placeholder)="([^"]*[\u3400-\u9fff][^"]*)"/g)].map(m=>m[1]);
for(const value of new Set([...copy,...attributes]))assert.ok(!/[\u3400-\u9fff]/.test(t(value,'en')),'Untranslated UI copy: '+value);
const technical=/^(?:SPTopo|UTF-8|EN|i|SVG|PNG|PDF|WGS84 · EPSG:3857|Natural Earth(?: Admin (?:0 Countries 5\.1\.1|1))?|Mapzen \/ AWS Terrain Tiles|[\d., ×（）():%\s-]+(?:cm|px)[（）()\s]*)$/;
for(const value of [...translatableHtml.matchAll(/>([^<>]+)</g)].map(m=>m[1].trim()).filter(s=>/[A-Za-z]/.test(s)&&!/[\u3400-\u9fff]/.test(s)&&!technical.test(s)))assert.ok(Object.hasOwn(STATIC_COPY,value)||Object.hasOwn(TEXT,value),'Unregistered English heading: '+value);
assert.equal(Object.keys(LANGUAGES).length,11);
const englishKeys=[...new Set([...Object.values(TEXT),...Object.values(MESSAGES).map(p=>p[1])])],placeholders=s=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
for(const [lang,pack] of Object.entries(LOCALE_TEXT)){
 for(const key of englishKeys){assert.ok(Object.hasOwn(pack,key.trim()),lang+' missing copy: '+key);assert.deepEqual(placeholders(pack[key.trim()]),placeholders(key),lang+' placeholder mismatch: '+key);}
 assert.ok(Object.values(pack).every(v=>typeof v==='string'&&v.length>0),'Complete interface dictionary: '+lang);
 assert.notEqual(t('匯出地圖',lang),'Export map');assert.notEqual(t('海拔分布',lang),'Elevation distribution');
 assert.equal(t('Taxon alpha',lang),'Taxon alpha');assert.match(tx('color',{group:'Taxon alpha'},lang),/Taxon alpha/);
 setLanguage(lang,storage);assert.equal(readLanguage(storage),lang);applyLanguage(doc);assert.equal(doc.documentElement.dir,lang==='ar'?'rtl':'ltr');
 assert.equal(nodes[4].nodeValue,t('MAP STUDIO',lang));assert.equal(attrs.placeholder,t('留空使用預設標題',lang));assert.equal(meta.content,t('上傳 CSV，製作全球地形與物種分布圖，支援共域圓餅及 PNG、SVG、PDF 匯出。',lang));
 const row=t('第 9 列欄位數與標題不同；含逗號的文字需加雙引號。',lang),terrain=t('海拔 4/5 · DEM z8（依範圍調整） · 1 張載入失敗',lang);
 assert.match(row,/9/);assert.notEqual(row,t('第 9 列欄位數與標題不同；含逗號的文字需加雙引號。','en'));assert.match(terrain,/4\/5/);assert.notEqual(terrain,t('海拔 4/5 · DEM z8（依範圍調整） · 1 張載入失敗','en'));
 assert.match(t('圖檔為 5906 × 23624 px，請降低匯出寬度後再試。',lang),/5906 × 23624/);
 for(const [key,pair]of Object.entries(MESSAGES)){const values=Object.fromEntries(placeholders(pair[1]).map(name=>[name,'VALUE_'+name])),value=tx(key,values,lang);for(const token of Object.values(values))assert.ok(value.includes(token),lang+' lost interpolation: '+key);assert.ok(!/\{\w+\}/.test(value));}
}
for(const key of Object.keys(TEXT))assert.ok(Object.hasOwn(ZH_HANS,key),'Simplified Chinese missing copy: '+key);
setLanguage('zh-Hans',storage);applyLanguage(doc);assert.equal(t('匯出地圖'),'汇出地图');assert.equal(doc.documentElement.dir,'ltr');assert.equal(tx('analysisStatus',{n:2,total:3,missing:1}),'有效海拔 2/3 笔；缺值 1 笔。');
assert.match(t('第 9 列欄位數與標題不同；含逗號的文字需加雙引號。'),/字段数|栏位数/);assert.equal(t('Invalid elevation analysis'),'海拔分析设定错误。');
setLanguage('zh-Hant',storage);applyLanguage(doc);assert.equal(nodes[0].nodeValue,' 使用說明 ');assert.equal(nodes[4].nodeValue,'地圖工作室');assert.equal(attrs.placeholder,'留空使用預設標題');
for(const key of Object.keys(STATIC_COPY))assert.ok(t(key,'en'));
assert.ok(!html.includes('languagePreviewNote'),'The completed interface no longer advertises an English fallback');
console.log(`PASS: ${englishKeys.length} copy/templates in every added language, placeholder parity, 11 preferences, localized placeholders/headings/metadata/errors, Simplified Chinese, reversible Arabic direction and untouched user data`);
