import {labelExclusions,intersectsExclusion} from './label-exclusions.mjs';
import {pathVertices} from './map-recipe.mjs';
import {placeName} from './place-names.mjs';
// Work on the visible, projected polygon rather than an off-screen centroid.
export function countryLabels(ctx,items,p,language,blocked=[],excludedPaths=[]){
 const occupied=[...blocked],out=[],exclusions=labelExclusions(excludedPaths);
 ctx.save();ctx.resetTransform();
 const shapes=items.flatMap(({feature,d,anchor})=>{
  if(!d)return [];let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const path of pathVertices(d))for(const [x,y] of path.points){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  left=Math.max(p.x+5,left);right=Math.min(p.x+p.w-5,right);top=Math.max(p.y+8,top);bottom=Math.min(p.y+p.h-8,bottom);
  if(right-left<16||bottom-top<12)return [];
  return [{feature,anchor,mask:new Path2D(d),left,right,top,bottom,area:(right-left)*(bottom-top)}];
 }).sort((a,b)=>a.area-b.area);
 for(const shape of shapes){
  const {left,right,top,bottom,mask,anchor}=shape,text=placeName(shape.feature.properties,language);if(!text)continue;
  const points=[[...(anchor||[NaN,NaN])],[(left+right)/2,(top+bottom)/2]];
  for(let j=0;j<11;j++)for(let i=0;i<11;i++)points.push([left+(right-left)*(i+.5)/11,top+(bottom-top)*(j+.5)/11]);
  const maxSize=Math.max(10,Math.min(16,9+Math.sqrt(shape.area)/100));let chosen;
  for(let size=maxSize;size>=9&&!chosen;size-=1){
   ctx.font=`${size}px Arial`;const metrics=ctx.measureText(text),w=Math.max(metrics.width,(metrics.actualBoundingBoxLeft||0)+(metrics.actualBoundingBoxRight||0));
   let best=-Infinity;
   for(const [x,y] of points){
    if(!Number.isFinite(x+y)||x-w/2<left||x+w/2>right||y-size/2<top||y+size/2>bottom)continue;
    if(intersectsExclusion(ctx,{left:x-w/2-2,right:x+w/2+2,top:y+size*.35-Math.max(size,metrics.actualBoundingBoxAscent||0)-2,bottom:y+size*.35+Math.max(size*.3,metrics.actualBoundingBoxDescent||0)+2},exclusions))continue;
    if(occupied.some(a=>Math.abs(x-a.x)<(w+a.w)/2+7&&Math.abs(y-a.y)<(size+(a.h||16))/2+6))continue;
    if(![-1,0,1].every(a=>[-1,0,1].every(b=>ctx.isPointInPath(mask,x+a*w/2,y+b*size*.45,'evenodd'))))continue;
    const score=-Math.hypot((x-(left+right)/2)/(right-left),(y-(top+bottom)/2)/(bottom-top));
    if(score>best){best=score;chosen={x,y,w,h:size,size,text};}
   }
  }
  if(chosen){out.push(chosen);occupied.push(chosen);}
 }
 ctx.restore();return out;
}
