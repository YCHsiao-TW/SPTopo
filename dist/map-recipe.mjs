// Export only display geometry, never executable code from user labels.
// Curves are sampled at sub-pixel precision for R's polygon/path primitives.
export function pathVertices(d){
 const tokens=d.match(/[MLCZ]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)||[],paths=[];let i=0,current=null,at=[0,0];
 const pair=()=>[Number(tokens[i++]),Number(tokens[i++])];
 while(i<tokens.length){const cmd=tokens[i++];
  if(cmd==='M'){at=pair();current={points:[at],closed:false};paths.push(current);}
  else if(cmd==='L'){at=pair();current.points.push(at);}
  else if(cmd==='C'){const start=at,a=pair(),b=pair(),end=pair();for(let k=1;k<=32;k++){const t=k/32,u=1-t;current.points.push([0,1].map(j=>u*u*u*start[j]+3*u*u*t*a[j]+3*u*t*t*b[j]+t*t*t*end[j]));}at=end;}
  else if(cmd==='Z'){current.closed=true;at=current.points[0];}
  else throw Error('Unsupported drawing path: '+cmd);
 }
 return paths;
}
export function recipeColor(color){if(!color?.startsWith('rgb('))return color;return '#'+color.match(/\d+/g).map(n=>Number(n).toString(16).padStart(2,'0')).join('');}
