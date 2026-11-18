#!/usr/bin/env python3
"""Build compact "next click" tables from the Wikipedia clickstream dumps.

For every source article: total link clicks + the top targets with their click counts.
Output: out/<lang>/<shard>.json  (shard = FNV-1a hash of the UTF-8 title, 4096 shards)
        out/meta.json
Each shard: {"Title": [total, "Target 1", n1, "Target 2", n2, ...], ...}   (titles with spaces)
"""
import gzip, heapq, json, os, re, sys, urllib.request

BASE = 'https://dumps.wikimedia.org/other/clickstream/'
LANGS = os.environ.get('LANGS', 'de').split()
TOPK = int(os.environ.get('TOPK', '10'))
MIN_N = int(os.environ.get('MIN_N', '15'))
SHARDS = 4096
OUT = os.environ.get('OUT', 'out')
UA = {'User-Agent': 'WikiGraph clickstream builder (github.com/frechmax/wikigraph)'}


def fnv1a(s):
    h = 0x811c9dc5
    for b in s.encode('utf-8'):
        h ^= b
        h = (h * 0x01000193) & 0xffffffff
    return h


def shard_of(title):
    return '%03x' % (fnv1a(title) % SHARDS)


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120)


def latest_month(lang):
    months = sorted(set(re.findall(r'href="(\d{4}-\d{2})/"', get(BASE).read().decode())), reverse=True)
    for m in months[:6]:
        page = get(BASE + m + '/').read().decode()
        if f'clickstream-{lang}wiki-{m}.tsv.gz' in page:
            return m
    raise SystemExit(f'no clickstream file found for {lang}')


def build(lang, stream, month):
    rows_link = {}   # src -> list of (n, tgt) for type == link
    rows_any = {}    # src -> same, any article->article pair (fallback if the dump has no 'link' type)
    totals_link, totals_any = {}, {}
    seen_link = False
    for raw in stream:
        parts = raw.decode('utf-8', 'replace').rstrip('\n').split('\t')
        if len(parts) < 4:
            continue
        prev, curr, typ, n = parts[0], parts[1], parts[2], parts[3]
        if prev.startswith('other-') or prev == curr:
            continue
        try:
            n = int(n)
        except ValueError:
            continue
        src, tgt = prev.replace('_', ' '), curr.replace('_', ' ')
        for rows, totals, ok in ((rows_link, totals_link, typ == 'link'), (rows_any, totals_any, True)):
            if not ok:
                continue
            totals[src] = totals.get(src, 0) + n
            if n < MIN_N:
                continue
            h = rows.setdefault(src, [])
            if len(h) < TOPK:
                heapq.heappush(h, (n, tgt))
            elif n > h[0][0]:
                heapq.heapreplace(h, (n, tgt))
        if typ == 'link':
            seen_link = True
    rows, totals = (rows_link, totals_link) if seen_link else (rows_any, totals_any)
    print(f'{lang}: {len(rows)} source articles, link type present: {seen_link}', file=sys.stderr)
    shards = {}
    for src, h in rows.items():
        entry = [totals[src]]
        for n, tgt in sorted(h, reverse=True):
            entry += [tgt, n]
        shards.setdefault(shard_of(src), {})[src] = entry
    d = os.path.join(OUT, lang)
    os.makedirs(d, exist_ok=True)
    for sh, data in shards.items():
        with open(os.path.join(d, sh + '.json'), 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    return {'month': month, 'sources': len(rows), 'link_type': seen_link}


def main():
    meta = {'shards': SHARDS, 'topk': TOPK, 'min_n': MIN_N, 'langs': {}}
    for lang in LANGS:
        if os.environ.get('LOCAL_FILE'):
            month, stream = 'local', gzip.open(os.environ['LOCAL_FILE'], 'rb')
        else:
            month = latest_month(lang)
            url = f'{BASE}{month}/clickstream-{lang}wiki-{month}.tsv.gz'
            print('downloading', url, file=sys.stderr)
            stream = gzip.GzipFile(fileobj=get(url))
        meta['langs'][lang] = build(lang, stream, month)
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'meta.json'), 'w') as f:
        json.dump(meta, f)


if __name__ == '__main__':
    main()
