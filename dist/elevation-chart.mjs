import {Painter} from './map.mjs';
import {escapeXML} from './core.mjs';
import {markerShape} from './markers.mjs';
import {parseBands,DEM_SOURCE} from './elevation-analysis.mjs';
import {t,getLanguage} from './i18n.mjs';
const jitter=key=>{let n=2166136261;for(const c of key)n=Math.imul(n^c.charCodeAt(0),16777619);return ((n>>>0)%1000/999-.5);};
export function renderElevationChart(scene,{canvas=document.createElement('canvas'),width=1500}={}){
 const {stats,analysis:a}=scene,lang=scene.language||getLanguage(),tr=v=>t(v,lang),W=Math.max(1200,220+stats.length*100),H=900,scale=width/W;canvas.width=width;canvas.height=Math.max(100,Math.round(H*scale));const ctx=canvas.getContext('2d');ctx.scale(scale,scale);const p=new Painter(ctx,true),plot={x:100,y:155,w:W-180,h:530},font=a.font;
 p.rect(0,0,W,H,'white');const title=a.title||tr('物種海拔分布');p.text(title,W/2,44,{size:24,align:'center',weight:'600'});
 p.text(tr(a.source==='csv'?'原始海拔（CSV）':a.source==='dem'?'DEM 推估海拔':'CSV 優先；缺值用 DEM')+' · '+tr(a.unit==='sites'?'獨立樣點':'全部紀錄'),W/2,73,{size:13,align:'center',color:'#697969'});
 const valid=stats.filter(s=>s.n),limits=valid.flatMap(s=>[s.min,s.max]),bands=a.bands?parseBands(a.bandStops):[];let lo=limits.length?Math.min(0,...limits):0,hi=limits.length?Math.max(...limits):4000;const step=[100,200,500,1000,2000,5000].find(s=>(hi-lo)/s<=9)||10000;lo=Math.floor(lo/step)*step;hi=Math.ceil((hi+step*.05)/step)*step;if(hi<=lo)hi=lo+1000;
 const y=v=>plot.y+plot.h*(hi-v)/(hi-lo),labels=a.bandLabels.split('|'),bandColors=['#e4f2e6','#eff2d5','#e2e8f4','#d4e2e8','#f2e1ce','#e6dce8'];
 for(let i=0;i<bands.length-1;i++){const min=Math.max(lo,bands[i]),max=Math.min(hi,bands[i+1]);if(max<=min)continue;const top=y(max),bottom=y(min);p.rect(plot.x,top,plot.w,bottom-top,bandColors[i%bandColors.length]);if(labels[i]?.trim())p.text(labels[i].trim(),plot.x+plot.w-10,(top+bottom)/2,{size:11,color:'#71806e',align:'right'});}
 for(let v=lo;v<=hi;v+=step){const cy=y(v);p.line(plot.x,cy,plot.x+plot.w,cy,'#cad4c9',.7);p.text(String(v),plot.x-14,cy+4,{size:font,align:'right'});}p.line(plot.x,plot.y,plot.x,plot.y+plot.h,'#53694f',1);p.line(plot.x,plot.y+plot.h,plot.x+plot.w,plot.y+plot.h,'#53694f',1);
 p.text(tr('海拔（m）'),plot.x,plot.y-21,{size:font});p.text(tr('中位數')+' · '+tr('核心範圍（25–75%）')+' · '+tr('最小–最大值'),W/2,108,{size:12,align:'center'});
 const space=plot.w/Math.max(1,stats.length),dots=stats.reduce((n,s)=>n+s.n,0),stride=Math.max(1,Math.ceil(dots/6000));
 stats.forEach((s,i)=>{const cx=plot.x+(i+.5)*space,c=scene.colors[s.group]||'#0072b2',bw=Math.min(54,space*.55);
  if(s.n){if(a.points)s.values.forEach((v,j)=>{if(j%stride)return;p.circle(cx+jitter(s.group+v.key)*bw*1.3,y(v.value),2.4,'#63726744','none',0);});p.line(cx,y(s.min),cx,y(s.max),'#364936',1);p.line(cx-6,y(s.min),cx+6,y(s.min),'#364936',1);p.line(cx-6,y(s.max),cx+6,y(s.max),'#364936',1);p.path(`M${cx-bw/2},${y(s.q3)}h${bw}v${y(s.q1)-y(s.q3)}h${-bw}Z`,{fill:c,stroke:c,width:1,opacity:.42});p.marker(cx,y(s.median),5,markerShape(scene.shapes,s.group),c,'#26372b',.7);}
  if(a.counts)p.text('n = '+s.n,cx,plot.y+plot.h+25,{size:12,align:'center'});
  const label=Object.hasOwn(scene.displayNames||{},s.group)?scene.displayNames[s.group]:s.group,words=label.split(/\s+/),lines=[];let line='';for(const word of words){if((line+' '+word).trim().length>16&&line){lines.push(line);line=word;}else line=(line+' '+word).trim();}if(line)lines.push(line);lines.slice(0,4).forEach((l,j)=>p.text(l,cx,plot.y+plot.h+53+j*(font+3),{size:Math.min(font,space*.15),align:'center',italic:scene.settings.italic,font:'Georgia'}));
 });
 if(!valid.length)p.text(tr('尚無可繪製的海拔資料'),W/2,plot.y+plot.h/2,{size:20,align:'center'});
 p.text(tr('鬚線為最小–最大值；盒子為四分位距；符號為中位數。'),100,H-63,{size:11,color:'#71816c'});p.text(tr('顯示點過多時僅抽樣繪點；統計仍使用全部有效資料。'),100,H-44,{size:11,color:'#71816c'});if(scene.demo)p.text(tr('示範資料 · 非真實採集紀錄'),100,H-23,{size:11,color:'#8c805a'});
 const metadata={application:'SPTopo',type:'elevation-distribution',quantiles:'R type 7',whiskers:'min-max',source:a.source==='csv'?'Original CSV elevation column':a.source==='dem'?'DEM estimates':'Original CSV elevations; missing values filled from DEM',demSource:DEM_SOURCE,demo:scene.demo,unit:a.unit,mode:a.source,column:a.column,pointStride:stride,statistics:stats.map(({values,...s})=>s)};
 return {canvas,svg:`<svg xmlns="http://www.w3.org/2000/svg" width="25cm" height="${25*H/W}cm" viewBox="0 0 ${W} ${H}"><metadata>${escapeXML(JSON.stringify(metadata))}</metadata><defs>${p.fontStyles()}</defs>${p.parts.join('')}</svg>`,width:W,height:H,page:{widthCm:25,heightCm:25*H/W},metadata};
}
