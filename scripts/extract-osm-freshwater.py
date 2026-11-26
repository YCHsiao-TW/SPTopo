#!/usr/bin/env python3
"""Build resumable per-object freshwater extracts from the pinned water theme."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
from pathlib import Path
import time
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen
from xml.etree import ElementTree

import duckdb

RELEASE = '2026-11-18.0'
PREFIX = f'release/{RELEASE}/theme=base/type=water/'
AWS = 'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/'
AZURE = 'https://overturemapswestus2.blob.core.windows.net/'
CHUNK = 32 * 1024 ** 2
FILTER = """
class IN ('river','stream','lake','reservoir','oxbow')
AND NOT COALESCE(is_salt,false)
AND COALESCE(source_tags['covered'],'no') <> 'yes'
AND COALESCE(source_tags['tidal'],'no') <> 'yes'
AND COALESCE(source_tags['waterway'],'') NOT IN ('ditch','drain','canal','tidal_channel','fish_pass')
AND bbox.ymin < 85 AND bbox.ymax > -85
AND CASE WHEN class = 'river' THEN true
         WHEN class = 'stream' THEN source_tags['width'] IS NOT NULL
           OR GREATEST((bbox.xmax-bbox.xmin)*COS(RADIANS((bbox.ymin+bbox.ymax)/2)),
                       bbox.ymax-bbox.ymin) >= IF(names.primary IS NULL,0.0065,0.002)
         ELSE (bbox.xmax-bbox.xmin)*(bbox.ymax-bbox.ymin) >= 0.000001 END
"""


def fetch(request, *, timeout=40):
    return urlopen(request, timeout=timeout)


def catalogue():
    with fetch(Request(AWS + '?' + urlencode({'list-type': '2','prefix': PREFIX}))) as r:
        root = ElementTree.fromstring(r.read())
    if root.findtext('{*}IsTruncated') == 'true':
        raise ValueError('Unexpected paginated release catalogue')
    rows = [{'key': row.findtext('{*}Key'), 'bytes': int(row.findtext('{*}Size')),
             'etag': row.findtext('{*}ETag').strip('"')}
            for row in root.findall('{*}Contents') if row.findtext('{*}Key').endswith('.parquet')]
    if not rows:
        raise ValueError('No source objects for the pinned release')
    return rows


def sql_text(s):
    return "'" + str(s).replace("'", "''") + "'"


def download(source, path):
    size = source['bytes']
    key = quote(source['key'], safe='/=')
    with path.open('wb') as target:
        target.truncate(size)
    spans = range(0, size, CHUNK)

    def read_span(start):
        end = min(start + CHUNK, size) - 1
        header = {'Range': f'bytes={start}-{end}'}
        for attempt in range(6):
            host = AWS if attempt % 2 == 0 else AZURE
            try:
                with fetch(Request(host + key, headers=header)) as response:
                    if response.status != 206 or response.headers.get('Content-Range') != f'bytes {start}-{end}/{size}':
                        raise OSError('Unexpected Content-Range')
                    if host == AWS and response.headers.get('ETag','').strip('"') != source['etag']:
                        raise OSError('Source ETag differs from the release catalogue')
                    data = response.read()
                if len(data) != end - start + 1:
                    raise OSError('Truncated range')
                with path.open('r+b', buffering=0) as target:
                    target.seek(start)
                    if target.write(data) != len(data):
                        raise OSError('Incomplete local write')
                return
            except OSError:
                if attempt == 5:
                    raise
                time.sleep(min(4, attempt+1))
    with ThreadPoolExecutor(max_workers=5) as pool:
        list(pool.map(read_span,spans))


def extract(source, number, directory, download_first):
    target = directory / f'water-{number:02}.parquet'
    receipt = target.with_suffix('.json')
    if target.is_file() and receipt.is_file() and json.loads(receipt.read_text()) == source:
        return target.name, 'cached'
    raw = directory / f'working-{number:02}.parquet'
    temporary = target.with_suffix('.pending')
    with duckdb.connect() as con:
        con.execute("LOAD spatial; LOAD httpfs; SET threads=1; SET memory_limit='550MB'; SET http_retries=2; SET http_timeout=35")
        for use_local in ((True,) if download_first else (False, True)):
            try:
                url = AWS + quote(source['key'], safe='/=')
                if use_local:
                    download(source, raw)
                    url = str(raw)
                query = f"""
                COPY (
                    SELECT id, bbox, class, COALESCE(names.primary, '') AS name,
                           COALESCE(source_tags['width'], '') AS width,
                           COALESCE(is_intermittent, source_tags['intermittent']='yes', false) AS seasonal,
                           ST_AsWKB(ST_SimplifyPreserveTopology(geometry, 0.00012)) AS wkb,
                           CAST(FLOOR((bbox.xmin+180)/8) AS INTEGER) AS strip
                    FROM read_parquet({sql_text(url)})
                    WHERE {FILTER}
                    ORDER BY strip, bbox.ymin, id
                ) TO {sql_text(temporary)} (FORMAT PARQUET, COMPRESSION ZSTD, ROW_GROUP_SIZE 65536)
                """
                con.execute(query)
                temporary.replace(target)
                receipt.write_text(json.dumps(source, separators=(',',':')))
                return target.name, str(target.stat().st_size)
            except Exception as error:
                if use_local:
                    raise
                print(f'{number:02} remote read failed. Retrying validated ranges: {type(error).__name__}',flush=True)
            finally:
                raw.unlink(missing_ok=True)
                temporary.unlink(missing_ok=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--jobs', type=int, default=3)
    parser.add_argument('--ranges', action='store_true')
    args=parser.parse_args()
    directory=args.directory.resolve()
    directory.mkdir(parents=True, exist_ok=True)
    manifest=directory/'catalogue.json'
    rows=json.loads(manifest.read_text()) if manifest.is_file() else catalogue()
    manifest.write_text(json.dumps(rows, indent=2)+'\n')
    with duckdb.connect() as con:
        con.execute('INSTALL spatial; INSTALL httpfs')
    failed=[]
    with ThreadPoolExecutor(max_workers=args.jobs) as pool:
        pending={pool.submit(extract, row, i, directory, args.ranges):i for i,row in enumerate(rows)}
        for finished, job in enumerate(as_completed(pending),1):
            try:
                print(f'{finished}/{len(rows)}', *job.result(), flush=True)
            except Exception as error:
                failed.append(pending[job])
                print(f'{pending[job]:02} failed: {error}', flush=True)
    if failed:
        raise SystemExit(f'Incomplete source objects: {failed}')


if __name__ == '__main__':
    main()
