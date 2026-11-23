import {markerShape} from './markers.mjs';
import {colorFor} from './core.mjs';
const SHAPES={circle:['圓形','circles'],square:['方形','squares'],triangle:['正三角形','upward-pointing triangles'],diamond:['菱形','diamonds'],plus:['十字形','plus signs'],cross:['叉形','crosses'],'triangle-down':['倒三角形','downward-pointing triangles'],'triangle-left':['左三角形','left-pointing triangles'],'triangle-right':['右三角形','right-pointing triangles'],pentagon:['五邊形','pentagons'],hexagon:['六邊形','hexagons'],octagon:['八邊形','octagons'],star4:['四芒星','four-pointed stars'],star5:['五角星','five-pointed stars'],star6:['六芒星','six-pointed stars'],question:['問號','question marks']};
const COLORS={black:['黑色','black'],white:['白色','white'],gray:['灰色','gray'],red:['紅色','red'],orange:['橙色','orange'],yellow:['黃色','yellow'],green:['綠色','green'],cyan:['青色','cyan'],blue:['藍色','blue'],purple:['紫色','purple'],pink:['粉紅色','pink'],brown:['棕色','brown'],ochre:['赭黃色','ochre']};
// Colour names are descriptive; the underlying map retains the exact custom RGB colour.
export function captionColor(hex,en=false){
 const palette={'#0072b2':'blue','#cc79a7':'pink','#d55e00':'orange','#56b4e9':'blue','#222222':'black','#e69f00':'orange','#009e73':'green','#a99000':'ochre'};
 hex=String(hex).toLowerCase();let key=palette[hex];
 if(!key){
  if(!/^#[0-9a-f]{6}$/.test(hex))return en?'custom-colored':'自訂色';
  const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;
  let h=d===0?0:max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4;h*=60;
  key=max<.18?'black':min>.92?'white':d<.10?'gray':h<15||h>=345?'red':h<45?(l<.4?'brown':'orange'):h<70?'yellow':h<165?'green':h<195?'cyan':h<260?'blue':h<295?'purple':'pink';
 }
 return COLORS[key][en?1:0];
}
export function captionGroups(state){return (state.groups||[...new Set(state.valid.map(p=>p.group))]).filter(g=>state.selected.has(g));}
export function captionSignature(state,language){return JSON.stringify({language,demo:state.demo,groups:captionGroups(state).map(g=>[g,state.displayNames?.[g]??g,state.colors?.[g],markerShape(state.shapes,g)])});}
export function figureCaption(state,language='zh-Hant'){
 const en=language==='en',groups=captionGroups(state),names=groups.map(g=>state.displayNames?.[g]??g);
 const subject=names.length&&names.length<=12?names.join(en?'; ':'、'):(en?'the selected species':'所選物種');
 const symbols=groups.map((g,i)=>{
  const index=state.groups?.indexOf(g)??i,color=captionColor(state.colors?.[g]||colorFor(index<0?i:index),en),shape=SHAPES[markerShape(state.shapes,g)][en?1:0];
  return en?`${names[i]} is represented by ${color} ${shape}`:`${color}${shape}代表${names[i]}`;
 });
 const description=symbols.length?(en?' '+symbols.join('; ')+'.':' '+symbols.join('；')+'。'):'';
 return (en?`Figure X. Distribution of ${subject}.`:`圖 X．${subject}的分布。`)+description+(state.demo?(en?' Demonstration data.':' 示範資料。'):'')+(en?' Map prepared with SPTopo.':' 使用 SPTopo 製圖。');
}
export function installCaption(getState){
 const button=document.createElement('button');button.id='captionOpen';button.type='button';button.className='secondary full';button.textContent='生成圖說 / Figure caption';document.getElementById('batchBtn').after(button);
 const dialog=document.createElement('dialog');dialog.setAttribute('aria-label','圖說 / Figure caption');dialog.innerHTML='<h2>圖說 / Figure caption</h2><p class="hint">可編輯草稿；修改地圖後請重新生成。 / Editable draft; regenerate after changing the map.</p><p id="captionStale" class="caption-stale" role="status" hidden></p><label class="field">Language<select id="captionLanguage"><option value="zh-Hant">繁體中文</option><option value="en">English</option></select></label><label class="field">圖說文字 / Caption<textarea id="captionText" rows="12" style="width:100%;font:inherit;line-height:1.7"></textarea></label><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" id="captionGenerate">重新生成 / Generate</button><button type="button" id="captionCopy">複製 / Copy</button><button type="button" id="captionClose">關閉 / Close</button></div><p id="captionMessage" role="status"></p>';document.body.append(dialog);
 const text=dialog.querySelector('#captionText'),language=dialog.querySelector('#captionLanguage'),message=dialog.querySelector('#captionMessage');
 const stale=dialog.querySelector('#captionStale');let signature=null;
 const refresh=()=>{const outdated=signature!==null&&signature!==captionSignature(getState(),language.value);stale.hidden=!outdated;stale.textContent=language.value==='en'?'Map styles or language changed. Regenerate to update the caption; this replaces your edited draft.':'圖例樣式或語言已變更，圖說尚未更新。重新生成會取代手動編輯內容。';};
 const generate=()=>{text.value=figureCaption(getState(),language.value);signature=captionSignature(getState(),language.value);message.textContent='';refresh();};
 button.addEventListener('click',()=>{if(signature===null){language.value=getState().language==='en'?'en':'zh-Hant';generate();}refresh();dialog.showModal();});
 language.addEventListener('change',refresh);
 dialog.querySelector('#captionGenerate').addEventListener('click',generate);
 dialog.querySelector('#captionClose').addEventListener('click',()=>dialog.close());
 dialog.querySelector('#captionCopy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(text.value);message.textContent='已複製 / Copied';}catch{text.focus();text.select();message.textContent='請手動複製選取文字 / Please copy the selected text manually.';}});
 return {refresh};
}
