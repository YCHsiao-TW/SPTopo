export function taxonLabel(state,group){
 return Object.hasOwn(state.displayNames||{},group)?state.displayNames[group]:group;
}

export function taxonLabelRuns(state,group){
 const label=taxonLabel(state,group),styles=state.legendEdits?.taxa?.nameRuns||{};
 const runs=Object.hasOwn(styles,group)?styles[group]:undefined;
 return runs?.map(run=>run.text).join('')===label?runs:[{text:label,italic:null}];
}

export function validateNameRuns(styles){
 if(!styles||typeof styles!=='object'||Array.isArray(styles))throw Error('圖例設定錯誤。');
 return Object.fromEntries(Object.entries(styles).map(([group,runs])=>{
  if(!Array.isArray(runs)||!runs.length||runs.some(run=>!run||typeof run.text!=='string'||!run.text||![true,false,null].includes(run.italic)))
   throw Error('圖例設定錯誤。');
  return [group,mergeRuns(runs)];
 }));
}

function mergeRuns(runs){
 const merged=[];
 for(const {text,italic} of runs){
  if(!text)continue;
  if(merged.at(-1)?.italic===italic)merged.at(-1).text+=text;
  else merged.push({text,italic});
 }
 return merged;
}

export function sliceNameRuns(runs,start,end=Infinity){
 const parts=[];
 let offset=0;
 for(const {text,italic} of runs){
  const left=Math.max(0,start-offset),right=Math.min(text.length,end-offset);
  if(left<right)parts.push({text:text.slice(left,right),italic});
  offset+=text.length;
 }
 return parts;
}

export function formatNameRange(runs,start,end,italic){
 return mergeRuns([
  ...sliceNameRuns(runs,0,start),
  ...sliceNameRuns(runs,start,end).map(run=>({...run,italic})),
  ...sliceNameRuns(runs,end)
 ]);
}

// Preserve the unchanged text around a native input edit.
export function updateNameRuns(runs,label,caret=label.length){
 const previous=runs.map(run=>run.text).join('');
 let start=0,oldEnd=previous.length,newEnd=label.length;
 const limit=Math.min(oldEnd,newEnd,caret);
 while(start<limit&&previous[start]===label[start])start++;
 while(oldEnd>start&&newEnd>Math.max(start,caret)&&previous[oldEnd-1]===label[newEnd-1]){
  oldEnd--;newEnd--;
 }
 const prefix=sliceNameRuns(runs,0,start),suffix=sliceNameRuns(runs,oldEnd);
 const replaced=sliceNameRuns(runs,start,oldEnd);
 const italic=(replaced[0]||prefix.at(-1)||suffix[0])?.italic??null;
 return mergeRuns([...prefix,{text:label.slice(start,newEnd),italic},...suffix]);
}
