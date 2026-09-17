#!/usr/bin/env python3
"""Take the Open homes & availability page (/pages/inspections) off the public
site (Naomi, 18 Sep 2026: "it needs to be removed - we can't have it have all
these private information or bulk responses").

    python3 shopify-app/hide-inspections-page.py            # show what would change
    python3 shopify-app/hide-inspections-page.py --write    # unpublish it
    python3 shopify-app/hide-inspections-page.py --publish --write   # put it back
    python3 shopify-app/hide-inspections-page.py --delete --write    # delete it for good

Unpublishing is the reversible version of removing it: the URL stops
answering and the page keeps its body in Shopify. The live body is also saved
at backups/inspections-page/. Note the Shopify Inbox agent reads PUBLISHED
pages only, so once this is unpublished the chat has no fact source and will
answer from the Persona alone until the answers are moved into
Apps > Inbox > Knowledge Base.
"""
import json, re, sys, os, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = {}
for line in open(os.path.join(ROOT, '.env')):
    m = re.match(r'^([A-Z_]+)=(.*)$', line.strip())
    if m: env[m.group(1)] = m.group(2).strip().strip('"').strip("'")

def gql(q, v=None):
    r = urllib.request.Request(f"https://{env['SHOPIFY_STORE']}/admin/api/2025-07/graphql.json", data=json.dumps({"query": q, "variables": v or {}}).encode(), headers={"X-Shopify-Access-Token": env['SHOPIFY_ADMIN_TOKEN'], "Content-Type": "application/json"})
    out = json.load(urllib.request.urlopen(r, timeout=60))
    if out.get('errors'): sys.exit(out['errors'])
    return out['data']

HANDLE = 'inspections'
write, delete, publish = '--write' in sys.argv, '--delete' in sys.argv, '--publish' in sys.argv

found = [p for p in gql('query($q:String!){ pages(first:5, query:$q){ nodes{ id handle title isPublished body } } }', {"q": f"handle:{HANDLE}"})['pages']['nodes'] if p['handle'] == HANDLE]
if not found:
    sys.exit(f"No /pages/{HANDLE} - nothing to remove.")
p = found[0]
print(f"/pages/{p['handle']} - {p['title']}, published={p['isPublished']}, {len(p['body']):,} characters of body")

if delete:
    if not write: sys.exit('Would DELETE it for good (add --write).')
    res = gql('mutation($id:ID!){ pageDelete(id:$id){ deletedPageId userErrors{ field message } } }', {"id": p['id']})['pageDelete']
    if res['userErrors']: sys.exit(res['userErrors'])
    print(f"Deleted /pages/{HANDLE}. The body is kept in backups/inspections-page/.")
    sys.exit()

want = bool(publish)
if p['isPublished'] == want:
    sys.exit(f"Already {'published' if want else 'unpublished'} - left as it is.")
if not write:
    sys.exit(f"Would set published={want} (add --write).")
res = gql('mutation($id:ID!,$p:PageUpdateInput!){ pageUpdate(id:$id, page:$p){ page{ handle isPublished } userErrors{ field message } } }',
          {"id": p['id'], "p": {"isPublished": want}})['pageUpdate']
if res['userErrors']: sys.exit(res['userErrors'])
print(f"/pages/{HANDLE} is now published={res['page']['isPublished']}." + ('' if want else ' The URL no longer answers, and the site chat has no fact source until the answers move to the Knowledge Base.'))
