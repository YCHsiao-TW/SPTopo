// Lightweight history: raw CSV data is never copied into each entry.
export function createHistory(read,write,{limit=60,onChange=()=>{},dataset=()=>null,group=()=>null}={}){
 let entries=[structuredClone(read())],index=0,identity=dataset(),queued=false,restoring=false,lastGroup=null,lastTime=0;
 const notify=()=>onChange(index>0,index<entries.length-1);
 const capture=()=>{
  if(restoring)return;
  const next=structuredClone(read()),key=dataset();
  if(key!==identity){identity=key;entries=[next];index=0;lastGroup=null;notify();return;}
  if(JSON.stringify(next)===JSON.stringify(entries[index])){notify();return;}
  const tag=group(),now=Date.now(),merge=tag&&tag===lastGroup&&now-lastTime<600&&index===entries.length-1&&index>0;
  entries=entries.slice(0,index+1);
  if(merge)entries[index]=next;else{entries.push(next);if(entries.length>limit+1)entries.shift();index=entries.length-1;}
  lastGroup=tag;lastTime=now;notify();
 };
 const move=delta=>{capture();const target=index+delta;if(target<0||target>=entries.length)return false;index=target;restoring=true;try{write(structuredClone(entries[index]));}finally{restoring=false;lastGroup=null;notify();}return true;};
 notify();return {capture,schedule(){if(restoring||queued)return;queued=true;queueMicrotask(()=>{queued=false;capture();});},undo:()=>move(-1),redo:()=>move(1)};
}
