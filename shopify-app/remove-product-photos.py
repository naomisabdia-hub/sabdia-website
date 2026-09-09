#!/usr/bin/env python3
"""Remove photos from a residence's Media whose file name matches a pattern.

    python3 shopify-app/remove-product-photos.py solace '^solace-\\d\\d\\.jpg$'

Only the product's media entries are removed; nothing on disk is touched.
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
if len(sys.argv) != 3: sys.exit(__doc__)
handle, pattern = sys.argv[1], re.compile(sys.argv[2], re.I)
prod = gql('query($h:String!){ productByHandle(handle:$h){ id title media(first:250){ nodes{ id ... on MediaImage{ image{ url } } } } } }', {"h": handle})['productByHandle']
if not prod: sys.exit(f"No residence with handle '{handle}'")
ids = []
for n in prod['media']['nodes']:
    if not n.get('image'): continue
    raw = os.path.basename(n['image']['url']).split('?')[0]
    base = re.sub(r'_[0-9a-f]{8}-[0-9a-f-]{27}(?=\.)', '', raw)
    if pattern.search(raw) or pattern.search(base): ids.append(n['id']); print('remove', raw)
if not ids: sys.exit('Nothing matched.')
res = gql('mutation($p:ID!,$m:[ID!]!){ productDeleteMedia(productId:$p, mediaIds:$m){ deletedMediaIds mediaUserErrors{ message } } }', {"p": prod['id'], "m": ids})['productDeleteMedia']
if res['mediaUserErrors']: sys.exit(res['mediaUserErrors'])
print(f"Removed {len(res['deletedMediaIds'])} photos from {prod['title']}.")
