// All entries have a different silhouette; none are fill-only variants.
export const MARKER_SHAPES=['circle','square','triangle','diamond','plus','cross','triangle-down','triangle-left','triangle-right','pentagon','hexagon','octagon','star4','star5','star6','question'];
export const MARKER_LABELS={circle:'● 圓形',square:'■ 方形',triangle:'▲ 正三角',diamond:'◆ 菱形',plus:'＋ 十字',cross:'× 叉形','triangle-down':'▼ 倒三角','triangle-left':'◀ 左三角','triangle-right':'▶ 右三角',pentagon:'五邊形',hexagon:'六邊形',octagon:'八邊形',star4:'四芒星',star5:'五角星',star6:'六芒星','arrow-up':'上箭頭','arrow-down':'下箭頭','arrow-left':'左箭頭','arrow-right':'右箭頭',heart:'心形',teardrop:'水滴',crescent:'月牙',hourglass:'沙漏',bowtie:'蝴蝶結',chevron:'V 形',question:'？ 問號'};
export const LEGACY_MARKER_SHAPES=['arrow-up','arrow-down','arrow-left','arrow-right','heart','teardrop','crescent','hourglass','bowtie','chevron'];
export function markerShape(shapes,group){return shapes&&Object.hasOwn(shapes,group)&&MARKER_SHAPES.includes(shapes[group])?shapes[group]:'circle';}
const rotate=(points,a)=>points.map(([x,y])=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)]);
const polygon=(n,r=1.1,angle=-Math.PI/2)=>Array.from({length:n},(_,i)=>[r*Math.cos(angle+i*2*Math.PI/n),r*Math.sin(angle+i*2*Math.PI/n)]);
export function markerPath(shape,x,y,r){
 const p=(a,b)=>(x+a*r).toFixed(2)+','+(y+b*r).toFixed(2);let points;
 if(shape==='square')points=[[-.85,-.85],[.85,-.85],[.85,.85],[-.85,.85]];
 else if(shape.startsWith('triangle'))points=rotate([[0,-1.12],[1,.88],[-1,.88]],({'triangle-down':Math.PI,'triangle-left':-Math.PI/2,'triangle-right':Math.PI/2})[shape]||0);
 else if(shape==='diamond')points=[[0,-1.15],[.95,0],[0,1.15],[-.95,0]];
 else if(shape==='plus'||shape==='cross'){points=[[-.3,-1],[.3,-1],[.3,-.3],[1,-.3],[1,.3],[.3,.3],[.3,1],[-.3,1],[-.3,.3],[-1,.3],[-1,-.3],[-.3,-.3]];if(shape==='cross')points=rotate(points,Math.PI/4);}
 else if(['pentagon','hexagon','octagon'].includes(shape))points=polygon({pentagon:5,hexagon:6,octagon:8}[shape],1.1,shape==='hexagon'?0:-Math.PI/2);
 else if(shape.startsWith('star')){const n=Number(shape.slice(4));points=Array.from({length:n*2},(_,i)=>{const a=-Math.PI/2+i*Math.PI/n,d=i%2?.44:1.18;return [Math.cos(a)*d,Math.sin(a)*d];});}
 else if(shape==='question')return `M${p(-.85,-.55)}C${p(-.85,-1.35)} ${p(.85,-1.35)} ${p(.85,-.55)}C${p(.85,-.15)} ${p(.25,.05)} ${p(.22,.35)}L${p(-.22,.35)}C${p(-.22,-.25)} ${p(.42,-.35)} ${p(.42,-.6)}C${p(.42,-.95)} ${p(-.42,-.95)} ${p(-.42,-.55)}ZM${p(-.23,.65)}L${p(.23,.65)}L${p(.23,1.1)}L${p(-.23,1.1)}Z`;
 else if(shape.startsWith('arrow-'))points=rotate([[-.35,1],[.35,1],[.35,0],[1,0],[0,-1.15],[-1,0],[-.35,0]],({'arrow-up':0,'arrow-down':Math.PI,'arrow-left':-Math.PI/2,'arrow-right':Math.PI/2})[shape]);
 else if(shape==='heart')return `M${p(0,1.12)}C${p(-.4,.65)} ${p(-1.2,.12)} ${p(-1.05,-.48)}C${p(-.9,-1.2)} ${p(-.2,-1.15)} ${p(0,-.65)}C${p(.2,-1.15)} ${p(.9,-1.2)} ${p(1.05,-.48)}C${p(1.2,.12)} ${p(.4,.65)} ${p(0,1.12)}Z`;
 else if(shape==='teardrop')return `M${p(0,-1.25)}C${p(-.35,-.5)} ${p(-1.05,0)} ${p(-.9,.58)}C${p(-.6,1.35)} ${p(.6,1.35)} ${p(.9,.58)}C${p(1.05,0)} ${p(.35,-.5)} ${p(0,-1.25)}Z`;
 else if(shape==='crescent')return `M${p(.65,-1.05)}C${p(-1.5,-1.15)} ${p(-1.5,1.15)} ${p(.65,1.05)}C${p(-.3,.6)} ${p(-.3,-.6)} ${p(.65,-1.05)}Z`;
 else if(shape==='hourglass')points=[[-.9,-1],[.9,-1],[-.9,1],[.9,1]];
 else if(shape==='bowtie')points=rotate([[-.9,-1],[.9,-1],[-.9,1],[.9,1]],Math.PI/2);
 else if(shape==='chevron')points=[[-1,-.85],[0,-.1],[1,-.85],[1,.1],[0,1],[-1,.1]];
 else return '';
 return points.map(([a,b],i)=>(i?'L':'M')+p(a,b)).join('')+'Z';
}
export function markerSVG(shape,fill='#244c3e'){return `<svg viewBox="-16 -16 32 32" aria-hidden="true">${shape==='circle'?'<circle cx="0" cy="0" r="11"':`<path d="${markerPath(shape,0,0,11)}"`} fill="${fill}" stroke="#26372b" stroke-width="1"/></svg>`;}
