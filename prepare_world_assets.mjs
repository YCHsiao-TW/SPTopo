import fs from 'node:fs/promises';
const assets=new URL('./dist/assets/',import.meta.url);
const keys=['1/0/0','1/1/0','1/0/1','1/1/1'];
await Promise.all(keys.map(async key=>{
 const response=await fetch(`https://elevation-tiles-prod.s3.amazonaws.com/terrarium/${key}.png`,{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error(`Terrain ${key}: HTTP ${response.status}`);
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes[0]!==137||bytes[1]!==80||bytes[2]!==78||bytes[3]!==71)throw Error(`Invalid terrain PNG: ${key}`);
 const file=new URL(`terrain/${key}.png`,assets);await fs.mkdir(new URL('.',file),{recursive:true});await fs.writeFile(file,bytes);
}));
const index=new URL('terrain-index.json',assets),existing=JSON.parse(await fs.readFile(index,'utf8'));
await fs.writeFile(index,JSON.stringify([...new Set([...existing,...keys])].sort())+'\n');
console.log('Prepared four global z1 terrain tiles; existing Taiwan tiles retained.');
