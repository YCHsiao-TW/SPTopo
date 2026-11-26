#!/usr/bin/env python3
"""Rank OSM water networks and publish resumable, static cartographic tiles."""
import argparse
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass
import gzip
import hashlib
import json
import math
from pathlib import Path
import re
import unicodedata

import duckdb
import numpy as np
import shapely
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Polygon, box

RELEASE='2026-11-18.0'
AREA=(220,18,.75,.085,.012)
SIMPLIFY=(.12,.022,.0028,.00082,.00024)
GRID=(.005,.001,.00025,.0001,.000025)
SPANS=(None,(8,30),(8,8),(2,2),(2,2))
COPYRIGHT='https://www.openstreetmap.org/copyright'


@dataclass(slots=True)
class Water:
    identifier: str
    geom: object
    kind: str
    tier: int
    score: float
    seasonal: bool
    name: str
    reaches: int = 1
    regional: bool = False


def encode(data):
    return json.dumps(data,separators=(',',':'),ensure_ascii=False,allow_nan=False).encode()


def parts(geom, kind):
    if geom.is_empty:
        return
    if geom.geom_type == kind:
        yield geom
    elif hasattr(geom,'geoms'):
        for part in geom.geoms:
            yield from parts(part,kind)


def km(coords):
    delta=np.diff(coords,axis=0)
    lat=(coords[1:,1]+coords[:-1,1])/2
    return float(np.hypot(delta[:,0]*np.cos(np.deg2rad(lat)),delta[:,1]).sum()*111.195)


def area(geom):
    _,s,_,n=geom.bounds
    return geom.area*111.195**2*math.cos(math.radians((s+n)/2))


def width_m(text):
    m=re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*(km|m|ft)?\s*',text)
    return float(m[1])*{None:1,'m':1,'km':1000,'ft':.3048}[m[2]] if m else 0


def waypoint(xy):
    return tuple(np.rint(xy*1e6).astype('int64'))


def named(text):
    return re.sub(r'\W+','',unicodedata.normalize('NFKC',text).casefold())


def chains(reaches):
    starts=defaultdict(list)
    ends=defaultdict(list)
    for i,(coords,*_) in enumerate(reaches):
        starts[waypoint(coords[0])].append(i)
        ends[waypoint(coords[-1])].append(i)
    following={}
    previous=set()
    for point,incoming in ends.items():
        choices=[]
        for a in incoming:
            left=reaches[a]
            for b in starts.get(point,[]):
                right=reaches[b]
                if a==b or left[4]!=right[4] or left[3] and right[3] and left[3]!=right[3]:
                    continue
                u=left[0][-1]-left[0][-2]
                v=right[0][1]-right[0][0]
                cosine=float(u@v/max(1e-16,np.linalg.norm(u)*np.linalg.norm(v)))
                same=bool(left[3] and left[3]==right[3])
                if same or cosine>-.2:
                    choices.append((-(cosine+2*same),a,b))
        for _,a,b in sorted(choices):
            if a not in following and b not in previous:
                following[a]=b
                previous.add(b)
    seen=set()
    for i in [k for k in range(len(reaches)) if k not in previous]+list(range(len(reaches))):
        path=[]
        while i is not None and i not in seen:
            seen.add(i)
            path.append(reaches[i])
            i=following.get(i)
        if path:
            yield path


def cell(geom, step):
    w,s,e,n=geom.bounds
    y=(s+n)/2
    return math.floor((y+90)/step), math.floor(((w+e)/2+180)*max(.25,math.cos(math.radians(y)))/step)


def rank_path(path,kind):
    coords=np.concatenate([path[0][0],*(part[0][1:] for part in path[1:])])
    length=sum(part[5] for part in path)
    width=max(part[6] for part in path)
    name=next((part[2] for part in path if part[2]),'')
    seasonal=path[0][4]
    if kind=='stream':
        if length<(.55 if name else .95) and width<3:
            return None
        tier=3 if not seasonal and (length>=8 or length>=3.8 and len(path)>1) else 4
    elif seasonal:
        tier=3 if length>=9 or width>=20 else 4
    elif length>=400 or width>=75 and length>=85:
        tier=0
    elif length>=50 or width>=12 and length>=20:
        tier=1
    elif length>=10 or length>=3.8 and (name or len(path)>1) or width>=8:
        tier=2
    else:
        tier=3 if length>=1.5 else 4 if length>=.35 else 5
    if tier==5:
        return None
    return Water(min(p[1] for p in path),LineString(coords),kind,tier,
                 length+min(width,600)*.65+2*bool(name)+3*(len(path)>1),seasonal,name,len(path))


def records(directory,west,east):
    files=sorted(str(p) for p in directory.glob('water-*.parquet'))
    with duckdb.connect() as con:
        con.execute("SET threads=1; SET memory_limit='550MB'")
        relation=con.sql('SELECT id,class,name,width,seasonal,wkb FROM read_parquet(?) WHERE bbox.xmax>? AND bbox.xmin<?',params=[files,west,east])
        reader=relation.to_arrow_reader(16384)
        for batch in reader:
            cols=batch.to_pydict()
            cols['wkb']=shapely.from_wkb(cols['wkb'],on_invalid='ignore')
            yield from zip(*cols.values(),strict=True)


def rank_water(directory,west,east):
    lines={'river':[],'stream':[]}
    polygons=[]
    seen=set()
    for source_id,kind,name,width,seasonal,geom in records(directory,west-.20,east+.20):
        if geom is None or geom.is_empty:
            continue
        if geom.geom_type in ('LineString','MultiLineString') and kind in lines:
            for i,line in enumerate(parts(geom,'LineString')):
                coords=shapely.get_coordinates(line)
                if len(coords)<2:
                    continue
                signature=hashlib.blake2b(min(coords.tobytes(),coords[::-1].tobytes()),digest_size=16).digest()
                if signature in seen:
                    continue
                seen.add(signature)
                lines[kind].append((coords,source_id+'-'+str(i),name,named(name),seasonal,km(coords),width_m(width)))
        elif geom.geom_type in ('Polygon','MultiPolygon'):
            if not geom.is_valid:
                geom=shapely.make_valid(geom)
            for i,poly in enumerate(parts(geom,'Polygon')):
                score=area(poly)
                bank=kind in ('river','stream')
                first=4 if kind=='stream' else 2 if bank else 3 if seasonal else 0
                tier=next((level for level in range(first,5) if score>=AREA[level]),5)
                if tier==5:
                    continue
                signature=hashlib.blake2b(shapely.normalize(poly).wkb,digest_size=16).digest()
                if signature in seen:
                    continue
                seen.add(signature)
                polygons.append(Water(source_id+'-'+str(i),poly,'bank' if bank else 'lake' if kind=='oxbow' else kind,tier,score,seasonal,name))
    del seen
    ranked=[row for kind in lines for path in chains(lines[kind]) if (row:=rank_path(path,kind))]
    cells=defaultdict(list)
    for row in ranked:
        if row.kind=='river' and not row.seasonal and row.score>=8:
            cells[cell(row.geom,1.6)].append(row)
    for candidates in cells.values():
        main=min(candidates,key=lambda x:(-x.score,x.identifier))
        main.regional=True
        main.tier=min(1,main.tier)
    for tier,step,limit in ((2,.47,6),(3,.19,9),(4,.067,12)):
        cells=defaultdict(list)
        for row in ranked:
            if row.tier==tier:
                cells[cell(row.geom,step)].append(row)
        for group in cells.values():
            for row in sorted(group,key=lambda x:(-x.score,x.identifier))[limit:]:
                row.tier+=1
    return ranked+polygons


def clean(kind,geom):
    line=kind in ('river','stream')
    values=list(parts(geom,'LineString' if line else 'Polygon'))
    if not values:
        return None
    merged=values[0] if len(values)==1 else MultiLineString(values) if line else MultiPolygon(values)
    return merged if line else shapely.orient_polygons(merged,exterior_cw=True)


def prepared(rows,level):
    eligible=[row for row in rows if row.tier<=level and (level!=1 or row.kind!='river' or row.tier==0 or row.regional)]
    shapes=[]
    for row in eligible:
        g=row.geom
        if level<2 and row.kind not in ('river','stream'):
            limit=(120,8)[level]
            g=Polygon(g.exterior,[ring for ring in g.interiors if area(Polygon(ring))>=limit])
        shapes.append(g)
    return eligible,shapely.simplify(shapes,SIMPLIFY[level],preserve_topology=True)


def tile_features(rows,geoms,tree,frame,level):
    indices=tree.query(frame,predicate='intersects')
    chosen=geoms[indices]
    try:
        clipped=shapely.intersection(chosen,frame,grid_size=GRID[level])
    except shapely.GEOSException:
        clipped=shapely.intersection(shapely.make_valid(chosen),frame,grid_size=GRID[level])
    water=[]
    for i,g in zip(indices,clipped,strict=True):
        row=rows[i]
        g=clean(row.kind,g)
        if g is not None:
            water.append((row,g))
    faces=[g for row,g in water if row.kind not in ('river','stream')]
    banks=shapely.STRtree(faces)
    for row,g in water:
        line=row.kind in ('river','stream')
        if line:
            hits=banks.query(g,predicate='intersects')
            if len(hits):
                candidates=[faces[i] for i in hits]
                try:
                    mask=shapely.union_all(candidates,grid_size=GRID[level])
                    g=shapely.difference(g,mask,grid_size=GRID[level])
                except shapely.GEOSException:
                    for face in candidates:
                        repaired=clean('bank',shapely.make_valid(face))
                        if repaired is not None:
                            g=shapely.difference(g,repaired)
                            g=clean(row.kind,g)
                            if g is None:
                                break
        if g is None:
            continue
        shape=clean(row.kind,g)
        if shape is None:
            continue
        style=('seasonal-line' if row.seasonal else 'main' if row.tier==0 else row.kind) if line else ('seasonal-area' if row.seasonal else 'area')
        yield {'id':row.identifier,'kind':row.kind,'style':style,'name':row.name,'reaches':row.reaches},shape


def write_tile(path,features,level):
    arcs=[]
    geometries=[]
    grid=GRID[level]

    def arc(line):
        xy=np.rint(shapely.get_coordinates(line)/grid).astype('int32')
        delta=np.diff(xy,axis=0,prepend=np.zeros((1,2),dtype='int32'))
        arcs.append(delta.tolist())
        return [len(arcs)-1]

    def rings(poly):
        return [arc(poly.exterior),*(arc(r) for r in poly.interiors)]

    for properties,shape in features:
        if level==4:
            properties.pop('id',None)
            properties.pop('reaches',None)
        kind=shape.geom_type
        if kind=='LineString':
            index=arc(shape)
        elif kind=='Polygon':
            index=rings(shape)
        elif kind=='MultiLineString':
            index=[arc(line) for line in shape.geoms]
        else:
            index=[rings(poly) for poly in shape.geoms]
        geometries.append({'type':kind,'properties':properties,'arcs':index})
    if not geometries and level:
        return None
    topology={'type':'Topology','transform':{'scale':[grid,grid],'translate':[0,0]},
              'arcs':arcs,'objects':{'freshwater':{'type':'GeometryCollection','geometries':geometries}}}
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_suffix('.pending')
    tmp.write_bytes(gzip.compress(encode(topology),compresslevel=6 if level==4 else 4,mtime=0))
    tmp.replace(path)
    return len(geometries),path.stat().st_size


def compact_fine_tile(src,dst):
    with gzip.open(src,'rb') as stream:
        tile=json.load(stream)
    for geometry in tile['objects']['freshwater']['geometries']:
        properties=geometry['properties']
        properties.pop('id',None)
        properties.pop('reaches',None)
    tmp=dst.with_suffix('.pending')
    tmp.write_bytes(gzip.compress(encode(tile),compresslevel=6,mtime=0))
    tmp.replace(dst)
    return dst.stat().st_size


def tile_stats(path,level):
    if not path.is_file():
        return None
    with gzip.open(path,'rb') as stream:
        tile=json.load(stream)
    features=tile['objects']['freshwater']['geometries']
    size=path.stat().st_size
    if level==4 and any('id' in row['properties'] for row in features):
        size=compact_fine_tile(path,path)
    return len(features),size


def compile_strip(source,out,i):
    west,east=-180+8*i,-172+8*i
    all_water=rank_water(source,west,east)
    tiles={}
    for level in range(5):
        rows,geoms=prepared(all_water,level)
        tree=shapely.STRtree(geoms)
        if not level:
            file=out/'.strips'/f'world-{i:02}.json.gz'
            if not file.is_file():
                write_tile(file,tile_features(rows,geoms,tree,box(west,-85,east,85),0),0)
            continue
        dx,dy=SPANS[level]
        for x in range((west+180)//dx,(east+180)//dx):
            for y in range(math.ceil(180/dy)):
                w,e=x*dx-180,(x+1)*dx-180
                s,n=max(-85,y*dy-90),min(85,(y+1)*dy-90)
                if s>=n:
                    continue
                key=f'{level}/{x}_{y}'
                file=f'tiles/{key}.json.gz'
                stats=tile_stats(out/file,level) or write_tile(out/file,tile_features(rows,geoms,tree,box(w,s,e,n),level),level)
                if stats:
                    tiles[key]={'file':file,'bbox':[w,s,e,n],'features':stats[0],'bytes':stats[1]}
    receipt=out/'.strips'/f'{i:02}.json'
    temporary=receipt.with_suffix('.pending')
    temporary.write_bytes(encode(tiles))
    temporary.replace(receipt)
    return i,len(tiles)


def merge_world(out):
    topology=None
    for i in range(45):
        with gzip.open(out/'.strips'/f'world-{i:02}.json.gz') as stream:
            tile=json.load(stream)
        if topology is None:
            topology=tile
            continue
        offset=len(topology['arcs'])
        topology['arcs'].extend(tile['arcs'])
        def shift(index):
            return [shift(a) for a in index] if isinstance(index,list) else index+offset
        for geom in tile['objects']['freshwater']['geometries']:
            geom['arcs']=shift(geom['arcs'])
            topology['objects']['freshwater']['geometries'].append(geom)
    (out/'world.json.gz').write_bytes(gzip.compress(encode(topology),compresslevel=5,mtime=0))


def publish_manifest(out,tiles):
    licence=Path(__file__).resolve().parents[1]/'dist/assets/freshwater/ODbL-1.0.txt'
    target=out/'ODbL-1.0.txt'
    if target.resolve()!=licence.resolve():
        target.write_bytes(licence.read_bytes())
    names=['world.json.gz','index.json','index.json.gz','source-objects.json','stats.json','SOURCES.txt','ODbL-1.0.txt']
    names.extend(row['file'] for row in tiles.values())
    files=[]
    for name in sorted(names):
        path=out/name
        with path.open('rb') as stream:
            digest=hashlib.file_digest(stream,'sha256').hexdigest()
        files.append([name,digest,path.stat().st_size])
    temporary=out/'distribution.pending'
    temporary.write_bytes(encode(files)+b'\n')
    temporary.replace(out/'distribution.json')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path)
    parser.add_argument('output',type=Path)
    parser.add_argument('--jobs',type=int,default=3)
    args=parser.parse_args()
    source,out=args.source.resolve(),args.output.resolve()
    manifest=json.loads((source/'catalogue.json').read_text())
    for i,entry in enumerate(manifest):
        path=source/f'water-{i:02}.parquet'
        if not path.is_file() or not path.with_suffix('.json').is_file() or json.loads(path.with_suffix('.json').read_text())!=entry:
            raise SystemExit(f'Source object {i} has not completed')
    (out/'.strips').mkdir(parents=True,exist_ok=True)
    pending=[i for i in range(45) if not (out/'.strips'/f'{i:02}.json').is_file()]
    print(f'{45-len(pending)} of 45 strips already built',flush=True)
    failed=[]
    with ProcessPoolExecutor(max_workers=args.jobs) as pool:
        jobs={pool.submit(compile_strip,source,out,i):i for i in pending}
        for job in as_completed(jobs):
            try:
                i,count=job.result()
                print(f'Strip {i+1}/45 complete ({count} tiles)',flush=True)
            except Exception as error:
                failed.append(jobs[job]+1)
                print(f'Strip {jobs[job]+1}/45 failed: {error}',flush=True)
    if failed:
        raise SystemExit(f'Incomplete strips: {failed}')
    merge_world(out)
    tiles={}
    for i in range(45):
        tiles.update(json.loads((out/'.strips'/f'{i:02}.json').read_text()))
    attribution={'release':RELEASE,'data':'OpenStreetMap via Overture Maps base/water',
        'attribution':'© OpenStreetMap contributors','copyright':COPYRIGHT,'licence':'ODbL 1.0',
        'licenceUrl':'https://opendatacommons.org/licenses/odbl/1-0/','coverage':[-180,-85,180,85],
        'format':'TopoJSON','areaThresholdKm2':AREA,'simplificationDegrees':SIMPLIFY,'quantizationDegrees':GRID,
        'source':'https://docs.overturemaps.org/schema/reference/base/water/'}
    index={'source':attribution,'overview':'world.json.gz','tiles':{k:{'file':v['file'],'bbox':v['bbox']} for k,v in sorted(tiles.items())}}
    raw=encode(index)
    (out/'index.json').write_bytes(raw)
    (out/'index.json.gz').write_bytes(gzip.compress(raw,compresslevel=5,mtime=0))
    (out/'source-objects.json').write_text(json.dumps(manifest,indent=2)+'\n')
    (out/'SOURCES.txt').write_text(json.dumps(attribution,indent=2,ensure_ascii=False)+'\n')
    stats={}
    for level in range(1,5):
        sizes=[row['bytes'] for key,row in tiles.items() if key.startswith(f'{level}/')]
        stats[str(level)]={'files':len(sizes),'bytes':sum(sizes),'maxBytes':max(sizes,default=0)}
    stats['0']={'files':1,'bytes':(out/'world.json.gz').stat().st_size}
    (out/'stats.json').write_text(json.dumps(stats,indent=2)+'\n')
    publish_manifest(out,tiles)


if __name__=='__main__':
    main()
