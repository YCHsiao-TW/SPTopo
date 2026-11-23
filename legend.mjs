import {effectiveMapSettings,attributionHeight} from './basemap-settings.mjs';
import {pageSize} from './page.mjs';
import {validateNameRuns} from './taxon-typography.mjs';
export const LEGEND_POSITIONS=['right','left','top-right','top-left','bottom-right','bottom-left','custom'];
export function legendOptions(s={}){return {position:s.legendPosition??'right',columns:s.legendColumns??1,font:s.legendFont??13,symbol:s.legendSymbol??4.4,x:s.legendX??75,y:s.legendY??10};}
export function legendSidebar(s){const o=legendOptions(s);return s.legend&&Object.values(legendKinds(s)).some(Boolean)&&['left','right'].includes(o.position)?220+(o.columns-1)*200:0;}
export function legendGeometry(s,count,plot){
 const f=pageSize(s),o=legendOptions(s),rows=Math.ceil(count/o.columns),width=200*o.columns+20,side=['left','right'].includes(o.position);
 const gap=Math.max(6,Math.min(Math.max(32,o.font*1.8,o.symbol*2+10),(Math.min(f.height,plot.h)-(s.bathymetry||s.isobaths?310:s.terrain?290:s.rivers||s.lakes?110:80)-(s.ecologyTheme==='biomes'&&s.legendBiomes!==false?390:0))/Math.max(1,rows)));
 const font=Math.min(o.font,gap*.65),symbol=Math.min(o.symbol,gap*.3),height=56+rows*gap+(s.bathymetry||s.isobaths?240:s.terrain?210:s.rivers||s.lakes?50:0);
 let x=o.position==='left'?30:f.width-222-(o.columns-1)*200,headerY=84;
 if(!side){
  const roomX=Math.max(0,plot.w-width-24),roomY=Math.max(0,plot.h-height-24);
  x=plot.x+12+(o.position==='custom'?roomX*o.x/100:o.position.endsWith('right')?roomX:0);
  headerY=plot.y+32+(o.position==='custom'?roomY*o.y/100:o.position.startsWith('bottom')?roomY:0);
 }
 const firstY=headerY+28,endY=firstY+rows*gap,terrainTop=side?Math.max(f.height-300,endY+26):endY+32;
 return {x,headerY,firstY,rows,width,height,gap,font,symbol,columns:o.columns,side,terrainTop,terrainHeight:Math.max(1,Math.min(150,f.height-90-terrainTop))};
}

export const LEGEND_KINDS=['taxa','elevation','depth','water','biomes'];
export const LEGEND_FLAGS={taxa:'legendSpecies',elevation:'legendElevation',depth:'legendDepth',water:'legendWater',biomes:'legendBiomes'};
export const LEGEND_LABELS={taxa:'物種圖例',elevation:'海拔圖例',depth:'海深圖例',water:'河湖圖例',biomes:'生物群系圖例'};
export const LEGEND_FONTS={serif:'Georgia',sans:'Arial',mono:'monospace'};
export function legendKinds(s){s=effectiveMapSettings(s);return {taxa:s.legendSpecies!==false,elevation:s.legendElevation!==false&&!!s.terrain&&s.ecologyTheme!=='biomes',depth:s.legendDepth!==false&&!!(s.bathymetry||s.isobaths),water:s.legendWater!==false&&!!(s.rivers||s.lakes),biomes:s.legendBiomes!==false&&s.ecologyTheme==='biomes'};}
export function legendStyle(s,kind,edits={}){const taxa=kind==='taxa',e=edits[kind]||{};return {font:taxa?s.legendFont??13:10,titleFont:taxa?Math.max(14,(s.legendFont??13)+1):12,family:taxa?'serif':'sans',italic:taxa?!!s.italic:false,bold:false,titleItalic:false,titleBold:taxa,columns:s.legendColumns??1,symbol:s.legendSymbol??4.4,gap:0,scaleHeight:150,background:!['left','right'].includes(s.legendPosition??'right'),border:!['left','right'].includes(s.legendPosition??'right'),color:'#4c5b43',title:'',...e};}
export function legendBlocks(s,count,plot,edits={}){
 s=effectiveMapSettings(s);if(!s.legend)return [];const kinds=legendKinds(s),effective={...s,terrain:kinds.elevation,bathymetry:!!s.bathymetry&&kinds.depth,isobaths:!!s.isobaths&&kinds.depth,rivers:!!s.rivers&&kinds.water,lakes:!!s.lakes&&kinds.water},g=legendGeometry(effective,kinds.taxa?count:0,plot),physicalPage=pageSize(s),page={...physicalPage,height:physicalPage.height-attributionHeight(s)},blocks=[];
 for(const kind of LEGEND_KINDS){if(!kinds[kind])continue;const style=legendStyle(s,kind,edits),columns=kind==='taxa'?style.columns:1,rows=Math.ceil(count/columns),head=Math.max(52,style.titleFont+style.font+14),gap=Math.min(style.gap||g.gap,(page.height-head-12)/Math.max(1,rows)),barTop=Math.max(32,style.titleFont+14),barHeight=Math.min(page.height-barTop-24,edits[kind]?.scaleHeight??g.terrainHeight),waterColumn=Math.max(98,style.font*7.4),biomeRow=Math.min(Math.max(24,style.font*2.5),(page.height-barTop-20)/15),height=kind==='biomes'?barTop+15*biomeRow+12:kind==='taxa'?head+4+rows*gap:kind==='water'?Math.max(54,style.titleFont+style.font+22):barTop+barHeight+16,width=kind==='biomes'?220:kind==='taxa'?200*columns+20:kind==='water'?22+waterColumn*(Number(!!s.rivers)+Number(!!s.lakes)):Math.max(96,45+style.font*3.3);
 let x=g.x-10+(kind==='depth'&&kinds.elevation?98:0),y=kind==='taxa'?g.headerY-24:kind==='water'?g.terrainTop+(kinds.elevation||kinds.depth?g.terrainHeight+25:0)-24:g.terrainTop-32;
 if(kind==='biomes')y=kinds.taxa?g.firstY+g.rows*g.gap+14:g.headerY-24;
 // Stored positions are page percentages and remain stable on export and resize.
 if(Number.isFinite(style.x))x=page.width*style.x/100;if(Number.isFinite(style.y))y=physicalPage.height*style.y/100;
 x=Math.max(2,Math.min(Math.max(2,page.width-width-2),x));y=Math.max(2,Math.min(Math.max(2,page.height-height-2),y));
 blocks.push({kind,x,y,w:width,h:height,style,columns,rows,gap,font:Math.min(style.font,gap*.65),symbol:Math.min(style.symbol,gap*.3),head,barTop,waterColumn,barHeight,biomeRow,side:g.side});
 }return blocks;
}
export function moveLegend(box,dx,dy,settings){const p=pageSize(settings),height=p.height-attributionHeight(settings);return {x:Math.max(2,Math.min(Math.max(2,p.width-box.w-2),box.x+dx))/p.width*100,y:Math.max(2,Math.min(Math.max(2,height-box.h-2),box.y+dy))/p.height*100};}
export function validateLegendEdits(value){
 if(value===undefined)return {};if(!value||typeof value!=='object'||Array.isArray(value))throw Error('圖例設定錯誤。');
 const numeric={x:[0,100],y:[0,100],font:[6,30],titleFont:[7,36],columns:[1,3],symbol:[2,12],gap:[0,70],scaleHeight:[60,300]},booleans=['italic','bold','titleItalic','titleBold','background','border'],out={};
 for(const [kind,edit] of Object.entries(value)){if(!LEGEND_KINDS.includes(kind)||!edit||typeof edit!=='object'||Array.isArray(edit))throw Error('圖例設定錯誤。');const clean={};for(const [key,v] of Object.entries(edit)){
  if(numeric[key]){if(!Number.isFinite(v)||v<numeric[key][0]||v>numeric[key][1]||key==='columns'&&!Number.isInteger(v))throw Error('圖例設定錯誤。');}
  else if(booleans.includes(key)){if(typeof v!=='boolean')throw Error('圖例設定錯誤。');}
  else if(key==='family'){if(!Object.hasOwn(LEGEND_FONTS,v))throw Error('圖例設定錯誤。');}
  else if(key==='color'){if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))throw Error('圖例設定錯誤。');}
  else if(key==='title'){if(typeof v!=='string'||v.length>100)throw Error('圖例設定錯誤。');}
  else if(key==='nameRuns'&&kind==='taxa'){clean[key]=validateNameRuns(v);continue;}
  else throw Error('圖例設定錯誤。');clean[key]=v;
 }out[kind]=clean;}return out;
}
export function validateDisplayNames(value){if(value===undefined)return {};if(!value||typeof value!=='object'||Array.isArray(value)||Object.values(value).some(v=>typeof v!=='string'||v.length>160))throw Error('圖例設定錯誤。');return Object.fromEntries(Object.entries(value));}
