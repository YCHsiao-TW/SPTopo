import {eastwardBounds,wrapLongitude,wrapUnit} from './longitude.mjs';
export const PALETTE=['#0072B2','#CC79A7','#D55E00','#56B4E9','#222222','#E69F00','#009E73','#A99000'];
export const RAMP=[[0,'#e9f7e4'],[50,'#d7f0d0'],[150,'#c3e8bb'],[300,'#addfa4'],[500,'#96d38c'],[800,'#b7df95'],[1100,'#d4e8a0'],[1400,'#edf0aa'],[1700,'#f8edb5'],[2000,'#f8dc9e'],[2300,'#f5c989'],[2600,'#efb374'],[2900,'#e99d65'],[3200,'#dd875a'],[3400,'#cf7654'],[3550,'#bf765d'],[3700,'#ae7a68'],[3850,'#9b7163'],[4000,'#866354']];
// Preserve every Taiwan color stop; extend high mountains without stretching
// the low-elevation greens, yellows and browns over a larger altitude range.
export const WORLD_RAMP=[...RAMP,[4500,'#80685d'],[5000,'#8b7d73'],[5500,'#9c948b'],[6000,'#b1ada5'],[6500,'#c5c3bc'],[7000,'#d7d8d2'],[7500,'#e4e7e1'],[8000,'#eef1ed'],[8500,'#f5f7f5'],[9000,'#ffffff']];
export function parseCSV(input){
 const text=input.replace(/^\uFEFF/,'');let rows=[],row=[],cell='',quoted=false,closed=false;
 const lines=[];let line=1,rowStart=1;
 const firstLine=text.split(/\r?\n/)[0];const delimiter=firstLine.includes('\t')&&!firstLine.includes(',')?'\t':',';
 function push(){row.push(cell);cell='';closed=false;}
 function finishRow(){push();if(row.some(x=>x.trim()!=='')){rows.push(row);lines.push(rowStart);}row=[];}
 for(let i=0;i<text.length;i++){const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else {cell+=c;if(c==='\r'||c==='\n'&&text[i-1]!=='\r')line++;}}
  else if(c===delimiter){push();}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;finishRow();rowStart=++line;}
  else if(c==='"'&&cell===''){quoted=true;}
  else if(closed&&c.trim()!==''){throw Error('CSV 引號後有多餘文字，請檢查分隔符號。');}
  else if(!closed)cell+=c;
 }
 if(quoted)throw Error('CSV 有未關閉的雙引號。');
 finishRow();
 if(rows.length<2)throw Error('需要標題列與至少一列資料。');
 lines.shift();
 const headers=rows.shift().map(x=>x.trim());
 if(headers.some(x=>!x)||new Set(headers).size!==headers.length)throw Error('欄位名稱不可空白或重複。');
 for(let i=0;i<rows.length;i++)if(rows[i].length!==headers.length)throw Error(`第 ${lines[i]} 列欄位數與標題不同；含逗號的文字需加雙引號。`);
 return {headers,rows,lines};
}
export function detectColumns(headers){
 const choose=names=>names.map(n=>headers.find(h=>h.toLowerCase()===n.toLowerCase())).find(Boolean)||'';
 return {lon:choose(['lon','long','longitude','lng','Site.long','Station.long','decimalLongitude','經度','x']),lat:choose(['lat','latitude','Site.lat','Station.lat','decimalLatitude','緯度','y']),group:choose(['species','taxon','scientificName','station.code','abbreviation','group','type','is_type','locality','locality_name','name','id'])};
}
export function normalizeRows(data,columns){
 const lonIndex=data.headers.indexOf(columns.lon),latIndex=data.headers.indexOf(columns.lat),groupIndex=data.headers.indexOf(columns.group);let valid=[],invalid=[];
 if(lonIndex<0||latIndex<0||lonIndex===latIndex)throw Error('請分別指定不同的經度與緯度欄位。');
 data.rows.forEach((row,i)=>{
  const a=row[lonIndex].trim(),b=row[latIndex].trim(),lon=Number(a),lat=Number(b);
  const reason=(!a||!b)?'缺少座標':(!Number.isFinite(lon)||!Number.isFinite(lat))?'座標不是數字':(lon<-180||lon>180||lat<-85.05112878||lat>85.05112878)?'超出經緯度或 Web Mercator 範圍':'';
  const line=data.lines?.[i]??i+2;
  if(reason)invalid.push({line,reason,row});else valid.push({lon,lat,group:groupIndex<0?'Point':(row[groupIndex].trim()||'Unknown'),row,line});
 });return {valid,invalid};
}
export function roundEven(value,digits){const scale=10**digits,n=value*scale,f=Math.floor(n),delta=n-f;const r=Math.abs(delta-.5)<1e-8?(f%2===0?f:f+1):Math.round(n);return r/scale;}
export function groupSites(points,digits=5,mode='presence',merge=true){
 const sites=new Map();points.forEach((p,i)=>{let lon=merge?roundEven(p.lon,digits):p.lon,lat=merge?roundEven(p.lat,digits):p.lat;const key=merge?`${lon},${lat}`:String(i);
  if(!sites.has(key))sites.set(key,{lon,lat,groups:new Map(),count:0,records:[]});const s=sites.get(key);s.groups.set(p.group,(s.groups.get(p.group)||0)+1);s.count++;s.records.push(p);
 });return [...sites.values()].map(s=>({...s,values:[...s.groups].sort((a,b)=>a[0].localeCompare(b[0])).map(([group,count])=>({group,count,value:mode==='presence'?1:count}))}));
}
export function project(lon,lat){lat=Math.max(-85.05112878,Math.min(85.05112878,lat));return [(lon+180)/360,(1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2];}
export function unproject(x,y){return [x*360-180,Math.atan(Math.sinh(Math.PI*(1-2*y)))*180/Math.PI];}
export function fitCamera(bounds,width,height,padding=.06){const [west,south,east,north]=eastwardBounds(bounds),a=project(west,north),b=project(east,south);return {x:wrapUnit((a[0]+b[0])/2),y:(a[1]+b[1])/2,zoom:Math.max(1,Math.min(17,Math.log2(Math.min(width/(b[0]-a[0]),height/(b[1]-a[1]))*(1-padding*2)/256)))};}
export function dataBounds(points,buffer=.15){
 if(!points.length)throw Error('沒有可定位的點位。');
 const xs=points.map(p=>wrapLongitude(p.lon)).sort((a,b)=>a-b);let gap=-1,index=0,s=Infinity,n=-Infinity;
 for(let i=0;i<xs.length;i++){const next=i+1<xs.length?xs[i+1]:xs[0]+360;if(next-xs[i]>gap){gap=next-xs[i];index=i;}}
 let w=xs[(index+1)%xs.length],e=xs[index];if(e<w)e+=360;
 for(const p of points){s=Math.min(s,p.lat);n=Math.max(n,p.lat);}
 if(e-w<.1){w-=.05;e+=.05;}if(n-s<.1){s-=.05;n+=.05;}w-=buffer;e+=buffer;
 return e-w>=360?[-180,Math.max(-85,s-buffer),180,Math.min(85,n+buffer)]:[wrapLongitude(w),Math.max(-85,s-buffer),wrapLongitude(e),Math.min(85,n+buffer)];
}
export function precisionDistance(digits,lat=23.5){const north=111320*10**-digits;return {north,east:north*Math.cos(lat*Math.PI/180)};}
export function escapeXML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
export function csvEncode(rows){return '\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');}
export function colorFor(i){if(PALETTE[i])return PALETTE[i];const h=(i*137.508)%360,s=.65,l=.4,a=s*Math.min(l,1-l);return '#'+[0,8,4].map(n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');}).join('');}
export function decodeTerrarium(r,g,b){return r*256+g+b/256-32768;}
export function siteKey(site,merge=true){return merge?`${site.lon},${site.lat}`:String(site.records[0].line);}
export function siteCatalog(points,settings){return groupSites(points,settings.digits,settings.pieMode,settings.pies).map((s,i)=>({...s,id:'S'+String(i+1).padStart(3,'0')}));}
export function withSiteIds(sites,catalog,merge=true){const ids=new Map(catalog.map(s=>[siteKey(s,merge),s.id]));return sites.map(s=>({...s,id:ids.get(siteKey(s,merge))}));}
export function siteTable(sites){return csvEncode([['site_id','longitude','latitude','taxon','record_count','site_total_records','source_rows'],...sites.flatMap(s=>s.values.map(v=>[s.id,s.lon,s.lat,v.group,v.count,s.count,s.records.filter(p=>p.group===v.group).map(p=>p.line).join(';')]))]);}
export function rampColor(e,ramp=RAMP){e=Math.max(ramp[0][0],Math.min(ramp.at(-1)[0],e));let i=1;while(i<ramp.length-1&&e>ramp[i][0])i++;const [a,ac]=ramp[i-1],[b,bc]=ramp[i],f=(e-a)/(b-a);return [1,3,5].map(k=>Math.round(parseInt(ac.slice(k,k+2),16)*(1-f)+parseInt(bc.slice(k,k+2),16)*f));}
