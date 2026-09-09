#!/usr/bin/env python3
"""Rename a residence's photos to house-plus-room names and set their alt text.

    python3 shopify-app/rename-product-photos.py solace shopify-app/photo-names/solace.json

The JSON maps the current file name (without extension) to the new one,
e.g. {"solace-01": "solace-kitchen-01"}. Alt text becomes "SOLACE - Kitchen 01".
"""
import json, os, re, sys, urllib.request
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
handle, mapping_path = sys.argv[1], sys.argv[2]
mapping = json.load(open(mapping_path))
prod = gql('query($h:String!){ productByHandle(handle:$h){ title media(first:250){ nodes{ id ... on MediaImage{ image{ url } } } } } }', {"h": handle})['productByHandle']
files, seen = [], set()
for n in prod['media']['nodes']:
    if not n.get('image'): continue
    base = os.path.basename(n['image']['url']).split('?')[0]
    stem, ext = os.path.splitext(base)
    stem = re.sub(r'_[0-9a-f]{8}-[0-9a-f-]{27}$', '', stem)  # strip Shopify's duplicate suffix
    new = mapping.get(stem)
    if not new or new in seen: continue
    seen.add(new)
    room = ' '.join(w.capitalize() for w in new.split('-')[1:])
    files.append({"id": n['id'], "filename": new + ext.lower(), "alt": f"{prod['title']} - {room}"})
if not files: sys.exit("Nothing matched the mapping.")
for i in range(0, len(files), 25):
    res = gql('mutation($f:[FileUpdateInput!]!){ fileUpdate(files:$f){ files{ ... on MediaImage{ image{ url } } } userErrors{ field message } } }', {"f": files[i:i+25]})['fileUpdate']
    if res['userErrors']: sys.exit(res['userErrors'])
    for f in files[i:i+25]: print("renamed ->", f['filename'])
print(f"Done: {len(files)} photos renamed on {prod['title']}.")
