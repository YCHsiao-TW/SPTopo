import {streetBasemap} from './basemap-settings.mjs';
import {legendBlocks,legendStyle,moveLegend,LEGEND_KINDS,LEGEND_FLAGS,LEGEND_LABELS,LEGEND_FONTS,validateLegendEdits} from './legend.mjs';
import {taxonLabel,taxonLabelRuns,formatNameRange,sliceNameRuns,updateNameRuns} from './taxon-typography.mjs';
import {pageSize,pointerPosition} from './page.mjs';
import {layout} from './map.mjs';
import {t,tx} from './i18n.mjs';

export function createLegendEditor({state,renderer,draw,syncSettings}){
 const $=id=>document.getElementById(id),panel=$('legendEditor'),root=$('legendHandles'),handles=new Map();let target='taxa',drag=null,suppressClick=false;
 const taxonSelect=$('legendEditTaxon'),nameInput=$('legendEditDisplayName'),namePreview=$('legendNamePreview');
 const italicButton=$('legendNameItalic'),uprightButton=$('legendNameUpright'),resetName=$('legendNameReset');
 let nameGroup;
 const count=()=>state.groups.filter(g=>state.selected.has(g)).length;
 const boxes=()=>legendBlocks(state.settings,count(),layout(state.settings),state.legendEdits);
 function boxFor(kind){return boxes().find(b=>b.kind===kind)||legendBlocks({...state.settings,legend:true,[LEGEND_FLAGS[kind]]:true,...(kind==='elevation'?{terrain:true,ecologyTheme:'off'}:kind==='depth'?{bathymetry:true}:kind==='water'?{lakes:true}:kind==='biomes'?{ecologyTheme:'biomes'}:{})},count(),layout(state.settings),state.legendEdits).find(b=>b.kind===kind);}
 function setEdit(key,value){const next={...state.legendEdits,[target]:{...state.legendEdits[target],[key]:value}};try{state.legendEdits=validateLegendEdits(next);syncSettings();draw();}catch{refresh();}}
 const fields={Title:'title',Family:'family',Font:'font',TitleFont:'titleFont',Italic:'italic',Bold:'bold',TitleItalic:'titleItalic',TitleBold:'titleBold',Color:'color',Columns:'columns',Symbol:'symbol',Gap:'gap',ScaleHeight:'scaleHeight',Background:'background',Border:'border',X:'x',Y:'y'};
 const legacy={font:'legendFont',columns:'legendColumns',symbol:'legendSymbol',italic:'italic'};
 for(const [suffix,key] of Object.entries(fields)){
  const el=$('legendEdit'+suffix);el.addEventListener(el.type==='checkbox'||el.tagName==='SELECT'?'change':'input',()=>{
   let value=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;if(el.type==='number'&&(el.value.trim()===''||!Number.isFinite(value)))return;
   if(target==='taxa'&&legacy[key]){
    const limits={font:[6,24],columns:[1,3],symbol:[2,12]};if(limits[key]){value=Math.max(limits[key][0],Math.min(limits[key][1],value));if(key==='columns')value=Math.round(value);}
    state.settings[legacy[key]]=value;const edit={...state.legendEdits.taxa};delete edit[key];state.legendEdits={...state.legendEdits,taxa:edit};syncSettings();draw();
   }else setEdit(key,value);
  });
 }
 function updateNameButtons(){
  const group=taxonSelect.value,available=state.groups.includes(group);
  italicButton.disabled=uprightButton.disabled=!available||nameInput.selectionStart===nameInput.selectionEnd||!nameInput.value.trim();
  resetName.disabled=!available||!taxonLabelRuns(state,group).some(run=>run.italic!==null);
 }
 function previewName(){
  namePreview.replaceChildren();
  const group=taxonSelect.value;
  if(state.groups.includes(group)){
   const style=legendStyle(state.settings,'taxa',state.legendEdits);
   namePreview.style.fontFamily=LEGEND_FONTS[style.family];
   namePreview.style.fontWeight=style.bold?'600':'normal';
   for(const run of taxonLabelRuns(state,group)){
    const span=document.createElement('span');
    span.textContent=run.text;
    span.style.fontStyle=(run.italic??style.italic)?'italic':'normal';
    namePreview.append(span);
   }
  }
  updateNameButtons();
 }
 function syncNames(){
  const old=taxonSelect.value;
  taxonSelect.replaceChildren();
  for(const group of state.groups)taxonSelect.add(new Option(group,group));
  taxonSelect.value=state.groups.includes(old)?old:state.groups[0]??'';
  const name=taxonLabel(state,taxonSelect.value);
  if(name!==nameInput.value)nameInput.value=name;
  if(nameGroup!==taxonSelect.value){
   nameInput.setSelectionRange(0,0);
   nameGroup=taxonSelect.value;
  }
  nameInput.disabled=!state.groups.length;
  previewName();
 }
 function saveNameRuns(group,runs){
  const taxa={...state.legendEdits.taxa},previous=taxa.nameRuns||{};
  if(runs.some(run=>run.italic!==null))taxa.nameRuns={...previous,[group]:runs};
  else{
   if(!Object.hasOwn(previous,group))return;
   const remaining={...previous};
   delete remaining[group];
   if(Object.keys(remaining).length)taxa.nameRuns=remaining;
   else delete taxa.nameRuns;
  }
  const edits={...state.legendEdits,taxa};
  if(!Object.keys(taxa).length)delete edits.taxa;
  state.legendEdits=edits;
 }
 function formatName(italic){
  const group=taxonSelect.value,start=nameInput.selectionStart,end=nameInput.selectionEnd;
  if(start===end||!state.groups.includes(group)||nameInput.value!==taxonLabel(state,group))return;
  saveNameRuns(group,formatNameRange(taxonLabelRuns(state,group),start,end,italic));
  nameInput.focus({preventScroll:true});
  nameInput.setSelectionRange(start,end);
  previewName();draw();
 }
 function refresh(){
  const streets=streetBasemap(state.settings);if(streets&&target!=='taxa')target='taxa';for(const option of $('legendEditTarget').options)option.disabled=streets&&option.value!=='taxa';
  for(const [kind,flag] of Object.entries(LEGEND_FLAGS))$('editor'+flag[0].toUpperCase()+flag.slice(1)).disabled=streets&&kind!=='taxa';
  const s=state.settings,style=legendStyle(s,target,state.legendEdits),box=boxFor(target),page=pageSize(s);
  $('legendEditTarget').value=target;$('editorLegendMaster').checked=s.legend;
  for(const [kind,flag] of Object.entries(LEGEND_FLAGS))$('editor'+flag[0].toUpperCase()+flag.slice(1)).checked=s[flag]!==false;
  for(const [suffix,key] of Object.entries(fields)){const el=$('legendEdit'+suffix);let value=style[key];if(key==='x')value=Number((box.x/page.width*100).toFixed(2));if(key==='y')value=Number((box.y/page.height*100).toFixed(2));if(el.type==='checkbox')el.checked=!!value;else el.value=value;}
  $('legendEditFont').max=target==='taxa'?'24':'30';$('legendTaxaLayout').hidden=target!=='taxa';$('legendScaleLayout').hidden=!['elevation','depth'].includes(target);$('legendDisplayNameSection').hidden=target!=='taxa';
  $('legendEditorAvailability').textContent=t(boxes().some(b=>b.kind===target)?'此圖例已顯示；修改會立即套用。':'此圖例目前隱藏；可開啟圖例或對應圖層。');syncNames();
  for(const [kind,button] of handles){button.setAttribute('aria-label',tx('editLegend',{name:t(LEGEND_LABELS[kind])}));button.dataset.label=t(LEGEND_LABELS[kind]);button.classList.toggle('selected',!panel.hidden&&kind===target);}
 }
 function open(kind='taxa',focus=false){target=LEGEND_KINDS.includes(kind)?kind:'taxa';panel.hidden=false;refresh();
  if(!matchMedia('(max-width:800px)').matches){const box=boxFor(target),rect=$('map').getBoundingClientRect(),page=pageSize(state.settings),viewport=document.documentElement.clientWidth||1360;panel.style.left=Math.max(12,Math.min(viewport-350,rect.left+box.x/page.width*rect.width-350))+'px';panel.style.right='auto';}
  if(focus)$('legendEditTarget').focus();draw();
 }
 function close(){panel.hidden=true;drag=null;document.body.classList.remove('legend-dragging');draw();}
 $('legendStudioBtn').addEventListener('click',()=>open(target,true));$('closeLegendEditor').addEventListener('click',close);panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();$('legendStudioBtn').focus();}});
 $('legendEditTarget').addEventListener('change',e=>{target=e.target.value;refresh();draw();});
 $('editorLegendMaster').addEventListener('change',e=>{state.settings.legend=e.target.checked;syncSettings();draw();});
 for(const [kind,flag] of Object.entries(LEGEND_FLAGS))$('editor'+flag[0].toUpperCase()+flag.slice(1)).addEventListener('change',e=>{state.settings[flag]=e.target.checked;syncSettings();draw();});
 taxonSelect.addEventListener('change',syncNames);
 for(const event of ['select','keyup','pointerup','focus'])nameInput.addEventListener(event,updateNameButtons);
 nameInput.addEventListener('input',()=>{
  const group=taxonSelect.value,name=nameInput.value;
  if(!state.groups.includes(group))return;
  const runs=name.trim()?updateNameRuns(taxonLabelRuns(state,group),name,nameInput.selectionStart):[];
  if(!name.trim()||name===group){
   const names={...state.displayNames};
   delete names[group];
   state.displayNames=names;
  }else state.displayNames={...state.displayNames,[group]:name};
  saveNameRuns(group,runs);
  previewName();draw();
 });
 for(const button of [italicButton,uprightButton]){
  button.addEventListener('pointerdown',e=>{if(document.activeElement===nameInput)e.preventDefault();});
  button.addEventListener('click',()=>formatName(button===italicButton));
 }
 resetName.addEventListener('click',()=>{saveNameRuns(taxonSelect.value,[]);previewName();draw();});
 nameInput.addEventListener('keydown',e=>{
  if(!(e.ctrlKey||e.metaKey)||!['i','I'].includes(e.key)||nameInput.selectionStart===nameInput.selectionEnd)return;
  e.preventDefault();
  const selected=sliceNameRuns(taxonLabelRuns(state,taxonSelect.value),nameInput.selectionStart,nameInput.selectionEnd);
  const defaultItalic=legendStyle(state.settings,'taxa',state.legendEdits).italic;
  formatName(!selected.every(run=>run.italic??defaultItalic));
 });
 $('resetLegendBlock').addEventListener('click',()=>{const edits={...state.legendEdits};delete edits[target];state.legendEdits=edits;if(target==='taxa'){Object.assign(state.settings,{legendFont:13,legendColumns:1,legendSymbol:4.4,italic:true});state.displayNames={};}syncSettings();draw();});
 for(const kind of LEGEND_KINDS){const button=document.createElement('button');button.className='legend-handle';button.type='button';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','legendEditor');button.dataset.kind=kind;root.append(button);handles.set(kind,button);
  button.addEventListener('pointerdown',e=>{if(e.button!==undefined&&e.button!==0)return;const box=boxes().find(b=>b.kind===kind);if(!box)return;e.preventDefault();button.focus({preventScroll:true});target=kind;drag={kind,box,start:pointerPosition(e.clientX,e.clientY,$('map').getBoundingClientRect(),state.settings),moved:false};button.setPointerCapture(e.pointerId);});
  button.addEventListener('pointermove',e=>{if(!drag||drag.kind!==kind)return;const p=pointerPosition(e.clientX,e.clientY,$('map').getBoundingClientRect(),state.settings),dx=p[0]-drag.start[0],dy=p[1]-drag.start[1];if(!drag.moved&&Math.hypot(dx,dy)<3)return;drag.moved=true;document.body.classList.add('legend-dragging');state.legendEdits={...state.legendEdits,[kind]:{...state.legendEdits[kind],...moveLegend(drag.box,dx,dy,state.settings)}};if(!panel.hidden)refresh();draw();});
  button.addEventListener('pointerup',()=>{if(!drag)return;suppressClick=drag.moved;if(suppressClick)setTimeout(()=>suppressClick=false,0);drag=null;document.body.classList.remove('legend-dragging');if(!suppressClick)open(kind);else{refresh();draw();}});
  button.addEventListener('pointercancel',()=>{drag=null;suppressClick=false;document.body.classList.remove('legend-dragging');draw();});
  button.addEventListener('click',()=>{if(suppressClick){suppressClick=false;return;}open(kind);});
  button.addEventListener('keydown',e=>{if(e.key==='Escape'){close();return;}const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta)return;e.preventDefault();const box=boxes().find(b=>b.kind===kind),step=e.shiftKey?10:2;state.legendEdits={...state.legendEdits,[kind]:{...state.legendEdits[kind],...moveLegend(box,delta[0]*step,delta[1]*step,state.settings)}};refresh();draw();});
 }
 function updateOverlay(){const current=boxes(),page=pageSize(state.settings);for(const [kind,button] of handles){const box=current.find(b=>b.kind===kind);button.hidden=!box;if(!box)continue;button.style.left=box.x/page.width*100+'%';button.style.top=box.y/page.height*100+'%';button.style.width=box.w/page.width*100+'%';button.style.height=box.h/page.height*100+'%';button.classList.toggle('selected',!panel.hidden&&kind===target);} }
 refresh();updateOverlay();return {refresh,updateOverlay,open,close,handles};
}
