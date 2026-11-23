import {legendKinds,legendStyle,LEGEND_FONTS} from './legend.mjs';
import {taxonLabel,taxonLabelRuns} from './taxon-typography.mjs';

const fontFamilies={Arial:'Sans',Georgia:'Serif',monospace:'Mono'};
const loaded=new Map(),pending=new Map();

export const needsLabelFont=text=>/[\u00a1-\u024f\u02b0-\u03ff\u1e00-\u1eff\u2640\u2642]/u.test(text);

function faceName(font,italic,weight){
 const family=fontFamilies[font];
 if(!family)return null;
 const bold=weight==='bold'||Number(weight)>=600;
 const style=bold?(italic?'BoldItalic':'Bold'):(italic?'Italic':'Regular');
 return 'Liberation'+family+'-'+style;
}

export function requestLabelFont(text,font,italic,weight){
 if(!globalThis.FontFace||!globalThis.document?.fonts||!needsLabelFont(text))return;
 const name=faceName(font,italic,weight);
 if(!name||loaded.has(name))return;
 if(!pending.has(name))pending.set(name,(async()=>{
  const response=await fetch('./assets/r-fonts/'+name+'.ttf');
  if(!response.ok)throw Error('Could not load map font: '+name);
  const bytes=await response.arrayBuffer(),alias='SPTopo-'+name;
  const style=italic?'italic':'normal';
  const fontWeight=weight==='bold'||Number(weight)>=600?'600':'400';
  const face=await new FontFace(alias,bytes,{style,weight:fontWeight}).load();
  document.fonts.add(face);
  loaded.set(name,{bytes,alias,style,weight:fontWeight});
 })().finally(()=>pending.delete(name)));
 return pending.get(name);
}

export function labelFace(text,font,italic,weight){
 return needsLabelFont(text)?loaded.get(faceName(font,italic,weight)):undefined;
}

export function labelFont(text,font,italic,weight){
 const face=labelFace(text,font,italic,weight);
 return face?face.alias+', '+font:font;
}

function selectedLabel(state){
 return state.groups.filter(group=>!state.selected||state.selected.has(group))
  .map(group=>taxonLabel(state,group))
  .find(needsLabelFont);
}

export function prepareLegendFonts(state){
 if(!state.settings.legend||!globalThis.FontFace)return;
 const loads=[];
 for(const [kind,visible] of Object.entries(legendKinds(state.settings))){
  if(!visible)continue;
  const style=legendStyle(state.settings,kind,state.legendEdits);
  const font=LEGEND_FONTS[style.family];
  loads.push(requestLabelFont(style.title,font,style.titleItalic,style.titleBold?'600':'normal'));
  if(kind==='taxa')for(const group of state.groups){
   if(state.selected&&!state.selected.has(group))continue;
   for(const run of taxonLabelRuns(state,group))
    loads.push(requestLabelFont(run.text,font,run.italic??style.italic,style.bold?'600':'normal'));
  }
 }
 const active=loads.filter(Boolean);
 if(active.length)return Promise.all(active);
}

export function prepareElevationFonts(state){
 if(!globalThis.FontFace)return;
 const loads=[
  requestLabelFont(state.analysis.title,'Arial',false,'600'),
  requestLabelFont(state.analysis.bandLabels,'Arial',false,'normal')
 ];
 const label=selectedLabel(state);
 if(label)loads.push(requestLabelFont(label,'Georgia',state.settings.italic,'normal'));
 const active=loads.filter(Boolean);
 if(active.length)return Promise.all(active);
}

export function embeddedLabelFont(face){
 if(!face.css){
  const bytes=new Uint8Array(face.bytes),chunks=[];
  for(let i=0;i<bytes.length;i+=8192)chunks.push(String.fromCharCode(...bytes.subarray(i,i+8192)));
  face.css=`@font-face{font-family:${face.alias};font-style:${face.style};font-weight:${face.weight};src:url(data:font/ttf;base64,${btoa(chunks.join(''))}) format('truetype');}`;
 }
 return face.css;
}
