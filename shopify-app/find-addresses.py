#!/usr/bin/env python3
"""List every street address the website can show (Naomi, 17 Sep 2026:
"never show the address - ensure its private"; suburb only, for every house).

    python3 shopify-app/find-addresses.py                 # store data only
    python3 shopify-app/find-addresses.py <pulled-theme>  # + a `shopify theme pull` folder

Reads pages (body + metafields), products (description, SEO, metafields, media
alt text), blog articles, collections and, when given, the pulled theme's
templates, section groups and settings. Read-only.
"""
import json, re, sys, os, glob, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = {}
for line in open(os.path.join(ROOT, '.env')):
    m = re.match(r'^([A-Z_]+)=(.*)$', line.strip())
    if m: env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
def gql(q, v=None):
    r = urllib.request.Request(f"https://{env['SHOPIFY_STORE']}/admin/api/2025-07/graphql.json", data=json.dumps({"query": q, "variables": v or {}}).encode(), headers={"X-Shopify-Access-Token": env['SHOPIFY_ADMIN_TOKEN'], "Content-Type": "application/json"})
    out = json.load(urllib.request.urlopen(r))
    if out.get('errors'): sys.exit(out['errors'])
    return out['data']

# A number then a street word, or a street name we know Sabdia has built on.
STREET = r"(?:Street|St|Avenue|Ave|Road|Rd|Court|Ct|Crescent|Cres|Parade|Pde|Terrace|Tce|Drive|Dr|Lane|Ln|Place|Pl|Close|Way|Boulevard|Blvd|Grove|Gr|Esplanade|Esp)"
KNOWN = "|".join(re.escape(st["name"]) for st in json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "address-privacy.json")))["streets"])
PAT = re.compile(rf"\b\d+[A-Za-z]?(?:[-/]\d+)?\s+(?:[A-Z][a-z]+\s+){{1,3}}{STREET}\b\.?|\b(?:{KNOWN})\s+{STREET}\b|\b\d+[A-Za-z]?\s+(?:{KNOWN})\b", re.I)

hits = []
def scan(where, text):
    if not text: return
    for m in PAT.finditer(text):
        s = max(0, m.start() - 50); e = min(len(text), m.end() + 50)
        hits.append((where, m.group(0), text[s:e].replace('\n', ' ')))

def paged(query, key, fields):
    after = None
    while True:
        d = gql(f'query($a:String){{ {query}(first:50, after:$a){{ pageInfo{{hasNextPage endCursor}} nodes{{ {fields} }} }} }}', {"a": after})[key]
        yield from d['nodes']
        if not d['pageInfo']['hasNextPage']: break
        after = d['pageInfo']['endCursor']

for p in paged('pages', 'pages', 'handle title body isPublished metafields(first:80){nodes{namespace key value}}'):
    tag = f"page {p['handle']}{'' if p['isPublished'] else ' (unpublished)'}"
    scan(f"{tag} / title", p['title']); scan(f"{tag} / body", p['body'])
    for mf in p['metafields']['nodes']: scan(f"{tag} / metafield {mf['namespace']}.{mf['key']}", mf['value'])
for p in paged('products', 'products', 'handle status title descriptionHtml seo{title description} metafields(first:80){nodes{namespace key value}} media(first:100){nodes{alt}}'):
    tag = f"product {p['handle']} ({p['status']})"
    scan(f"{tag} / title", p['title']); scan(f"{tag} / description", p['descriptionHtml'])
    scan(f"{tag} / seo", json.dumps(p['seo']))
    for mf in p['metafields']['nodes']: scan(f"{tag} / metafield {mf['namespace']}.{mf['key']}", mf['value'])
    for i, md in enumerate(p['media']['nodes']): scan(f"{tag} / photo {i+1} alt", md['alt'])
for a in paged('articles', 'articles', 'handle title body summary isPublished'):
    tag = f"article {a['handle']}"
    scan(f"{tag} / title", a['title']); scan(f"{tag} / body", a['body']); scan(f"{tag} / summary", a['summary'])
for c in paged('collections', 'collections', 'handle title descriptionHtml seo{title description}'):
    scan(f"collection {c['handle']}", c['descriptionHtml'] + json.dumps(c['seo']))

if len(sys.argv) > 1:
    base = sys.argv[1]
    for f in sorted(glob.glob(f"{base}/templates/*.json") + glob.glob(f"{base}/sections/*.json") + glob.glob(f"{base}/config/settings_data.json")):
        scan(f"theme {os.path.relpath(f, base)}", open(f).read())

by = {}
for where, found, ctx in hits: by.setdefault(where, []).append((found, ctx))
for where in by:
    print(f"\n{where}")
    for found, ctx in by[where][:6]: print(f"   [{found}]  ...{ctx}...")
    if len(by[where]) > 6: print(f"   (+{len(by[where]) - 6} more)")
print(f"\n{len(hits)} address mentions in {len(by)} places")
