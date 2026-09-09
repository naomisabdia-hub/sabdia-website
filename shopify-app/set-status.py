#!/usr/bin/env python3
"""Set a residence's Status (For Sale / Sold …) from the Terminal.

    python3 shopify-app/set-status.py aether "For Sale"
    python3 shopify-app/set-status.py capri "Sold Prior to Completion"
    python3 shopify-app/set-status.py --all      # sets every residence to its current group

Same as Products > the residence > Status > Save; every page follows.
"""
import json, re, sys, os, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = {}
for line in open(os.path.join(ROOT, '.env')):
    m = re.match(r'^([A-Z_]+)=(.*)$', line.strip())
    if m: env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
def gql(q, v=None):
    r = urllib.request.Request(f"https://{env['SHOPIFY_STORE']}/admin/api/2025-07/graphql.json", data=json.dumps({"query": q, "variables": v or {}}).encode(), headers={"X-Shopify-Access-Token": env['SHOPIFY_ADMIN_TOKEN'], "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(r))
CHOICES = ["For Sale", "Under Offer", "Coming Soon", "Sold Prior to Completion", "Sold"]
prods = gql('{ products(first:50){nodes{id handle title tags metafield(namespace:"custom",key:"status"){value}}} }')['data']['products']['nodes']
if len(sys.argv) == 2 and sys.argv[1] == '--all':
    want = {p['handle']: (p['metafield'] or {}).get('value') or ('Sold Prior to Completion' if 'sold' in p['tags'] else 'For Sale') for p in prods if 'property' in p['tags']}
elif len(sys.argv) == 3:
    if sys.argv[2] not in CHOICES: sys.exit(f"Status must be one of: {', '.join(CHOICES)}")
    want = {sys.argv[1]: sys.argv[2]}
else:
    sys.exit(__doc__)
mfs = [{"ownerId": p['id'], "namespace": "custom", "key": "status", "type": "single_line_text_field", "value": want[p['handle']]} for p in prods if p['handle'] in want]
if not mfs: sys.exit(f"No residence with handle '{list(want)[0]}'. Handles: {', '.join(p['handle'] for p in prods)}")
res = gql('mutation($m:[MetafieldsSetInput!]!){ metafieldsSet(metafields:$m){ metafields{ owner{ ... on Product{title} } value } userErrors{field message} } }', {"m": mfs})['data']['metafieldsSet']
if res['userErrors']: sys.exit(res['userErrors'])
for m in res['metafields']: print(f"{m['owner']['title']}: {m['value']}")
print("Done - the site follows straight away.")
