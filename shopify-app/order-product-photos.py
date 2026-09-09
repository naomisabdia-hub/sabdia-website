#!/usr/bin/env python3
"""Put chosen photos first on a residence (hero = first, gallery = next six).

    python3 shopify-app/order-product-photos.py sierra sierra-hero sierra-kitchen-01 sierra-living-kitchen-01 ...

Names are file names without extension; anything not listed keeps its
relative order after them.
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
if len(sys.argv) < 3: sys.exit(__doc__)
handle, wanted = sys.argv[1], sys.argv[2:]
prod = gql('query($h:String!){ productByHandle(handle:$h){ id title media(first:250){ nodes{ id ... on MediaImage{ image{ url } } } } } }', {"h": handle})['productByHandle']
if not prod: sys.exit(f"No residence with handle '{handle}'")
by_stem = {}
for n in prod['media']['nodes']:
    if not n.get('image'): continue
    base = os.path.basename(n['image']['url']).split('?')[0]
    stem = re.sub(r'_[0-9a-f]{8}-[0-9a-f-]{27}$', '', os.path.splitext(base)[0]).lower()
    by_stem.setdefault(stem, n['id'])
moves, missing = [], []
for i, w in enumerate(wanted):
    mid = by_stem.get(w.lower())
    if mid: moves.append({"id": mid, "newPosition": str(i)})
    else: missing.append(w)
if missing: print("not on this residence, skipped:", ', '.join(missing))
if not moves: sys.exit("Nothing to move.")
res = gql('mutation($p:ID!,$m:[MoveInput!]!){ productReorderMedia(id:$p, moves:$m){ mediaUserErrors{ message } } }', {"p": prod['id'], "m": moves})['productReorderMedia']
if res['mediaUserErrors']: sys.exit(res['mediaUserErrors'])
print(f"{prod['title']}: first {len(moves)} photos set ->", ', '.join(w for w in wanted if w not in missing))
