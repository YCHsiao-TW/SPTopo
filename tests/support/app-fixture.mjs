import fs from 'node:fs/promises';
import {MapRenderer} from '../../dist/map.mjs';

// A DOM event fixture exercises app.mjs itself. Canvas drawing is covered by
// the separate native rendering checks; this fixture does not check layout.
export async function openApp(){
 const downloads=[],blobs=new Map(),elements=new Map(),frames=[];
 class Element{
  constructor(tag='div',attrs={}){this.tagName=tag.toUpperCase();this.attrs={...attrs};this.id=attrs.id||'';this.type=attrs.type||'';this.value=attrs.value||'';this.checked='checked' in attrs;this.hidden='hidden' in attrs;this.disabled=false;this.style={};this.dataset={};this.children=[];this.handlers=new Map();this.textContent='';const classes=new Set((attrs.class||'').split(/\s+/));this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),toggle(x,on){if(on??!classes.has(x))classes.add(x);else classes.delete(x);},contains:x=>classes.has(x)};}
  after(node){if(node.id)elements.set(node.id,node);}
  set innerHTML(html){this._html=html;for(const m of html.matchAll(/<([a-z][\w-]*)\b([^>]*\bid="[^"]+"[^>]*)>/g)){const a=attrs(m[2]);elements.set(a.id,new Element(m[1],a));}}
  get innerHTML(){return this._html||'';}
  querySelector(selector){return elements.get(selector.slice(1));}
  select(){this.selected=true;}
  setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}
  get options(){return this.children;}
  add(option){this.append(option);}
  append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  setAttribute(key,value){this.attrs[key]=String(value);}
  getAttribute(key){return this.attrs[key]??null;}
  hasAttribute(key){return key in this.attrs;}
  closest(){return null;}
  addEventListener(name,fn){if(!this.handlers.has(name))this.handlers.set(name,[]);this.handlers.get(name).push(fn);}
  async emit(name,extra={}){const event={target:this,preventDefault(){},...extra};for(const fn of this.handlers.get(name)||[])await fn(event);}
  click(){if(this.tagName==='A')downloads.push({name:this.download,blob:blobs.get(this.href)});else return this.emit('click');}
  remove(){}
  focus(){}
  scrollIntoView(){}
  setPointerCapture(){}
  getBoundingClientRect(){return {left:0,top:0,right:1200,bottom:960,width:1200,height:960};}
  showModal(){this.open=true;}
  close(){this.open=false;}
 }
 const attrs=text=>Object.fromEntries([...text.matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(m=>[m[1],m[2]??'']));
 const html=await fs.readFile(new URL('../../dist/index.html',import.meta.url),'utf8');
 for(const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*\bid="[^"]+"[^>]*)>/g)){const a=attrs(match[2]);elements.set(a.id,new Element(match[1],a));}
 for(const match of html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){
  const select=elements.get(match[1]);
  for(const option of match[2].matchAll(/<option\b([^>]*)>([^<]*)<\/option>/g)){const a=attrs(option[1]),el=new Element('option',a);el.textContent=option[2];select.add(el);if(select.value===''||'selected' in a)select.value=el.value;}
 }
 const tabs=['data','style','export'].map(name=>{const el=new Element('button');el.dataset.panel=name;return el;});
 const body=new Element('body'),meta={},doc={body,documentElement:{lang:''},getElementById:id=>elements.get(id),createElement:tag=>new Element(tag),createTreeWalker:()=>({nextNode:()=>null}),querySelectorAll:selector=>selector==='[data-panel]'?tabs:[],querySelector:()=>meta};
 globalThis.document=doc;globalThis.Option=class extends Element{constructor(text,value){super('option',{value});this.textContent=text;}};
 globalThis.matchMedia=()=>({matches:false});globalThis.localStorage={getItem:()=>null,setItem(){}};
 globalThis.requestAnimationFrame=callback=>{frames.push(callback);return frames.length;};
 const timer=globalThis.setTimeout;globalThis.setTimeout=(fn,ms,...args)=>{const handle=timer(fn,ms,...args);handle.unref();return handle;};
 globalThis.fetch=async url=>{if(url==='./assets/terrain-index.json')return new Response('[]');if(/^\.\/assets\/r-fonts\/(?:Liberation(?:Sans|Serif|Mono)-[A-Za-z]+\.ttf|OFL\.txt)$/.test(url))return new Response(await fs.readFile(new URL('../../dist/'+url,import.meta.url)));if(/^\.\/assets\/(world-countries\.geojson|boundaries\.json|world-admin1\.json|water-rivers\.json|water-lakes\.json|coast-detail\/(?:index|overview|tiles\/\d+(?:_\d+)+)\.json)$/.test(url))return new Response(await fs.readFile(new URL('../../dist/'+url,import.meta.url),'utf8'));throw Error('Unexpected fixture fetch: '+url);};
 URL.createObjectURL=blob=>{const key='blob:fixture/'+blobs.size;blobs.set(key,blob);return key;};URL.revokeObjectURL=url=>blobs.delete(url);
 const rendered=[];
 MapRenderer.prototype.init=async function(){};
 MapRenderer.prototype.status=function(){return {ready:true,message:'彩色海拔已關閉 · 行政區底圖'};};
 MapRenderer.prototype.render=function(scene,options={}){this.hitMarkers=[];rendered.push({exporting:!!options.canvas,legendEdits:structuredClone(scene.legendEdits||{}),displayNames:{...scene.displayNames},settings:{...scene.settings},camera:{...scene.camera},groups:[...scene.groups],colors:{...scene.colors},shapes:{...scene.shapes},selected:[...scene.selected],sites:scene.sites});return {svg:'<svg xmlns="http://www.w3.org/2000/svg"><text>fixture</text></svg>',...(options.rBundle?{recipe:{basemap:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',commands:[]}}:{})};};
 await import('../../dist/app.mjs');
 const tick=async()=>{await new Promise(resolve=>setImmediate(resolve));};
 const flush=async()=>{for(let i=0;i<4;i++){while(frames.length)frames.shift()(0);await tick();}};
 const get=id=>elements.get(id);
 const file=(name,text)=>({name,arrayBuffer:async()=>new TextEncoder().encode(text).buffer,text:async()=>text});
 const loadCSV=async(name,text)=>{get('csvFile').files=[file(name,text)];await get('csvFile').emit('change');await flush();};
 const loadConfig=async config=>{get('configFile').files=[file('settings.json',JSON.stringify(config))];await get('configFile').emit('change');await flush();};
 const savedConfig=async()=>{await get('saveConfig').emit('click');return JSON.parse(await downloads.at(-1).blob.text());};
 await flush();return {get,downloads,rendered,tabs,flush,file,loadCSV,loadConfig,savedConfig};
}
