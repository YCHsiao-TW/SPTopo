import {pageSize} from './page.mjs';
export function selectionRect(a,b,p){const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));const x1=clamp(a[0],p.x,p.x+p.w),x2=clamp(b[0],p.x,p.x+p.w),y1=clamp(a[1],p.y,p.y+p.h),y2=clamp(b[1],p.y,p.y+p.h);return {x:Math.min(x1,x2),y:Math.min(y1,y2),w:Math.abs(x2-x1),h:Math.abs(y2-y1)};}
export function cropSettings(settings,rect,layout){
 const width=settings.pageWidth||25,target=rect.w/rect.h;let lo=Math.max(.25,width/60),hi=Math.min(4,width/5);
 for(let i=0;i<40;i++){const ratio=(lo+hi)/2,p=layout({...settings,pageHeight:width/ratio});if(p.w/p.h<target)lo=ratio;else hi=ratio;}
 const out={...settings,pageHeight:Math.round(width/((lo+hi)/2)*100)/100};pageSize(out);return out;
}
