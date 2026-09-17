#!/usr/bin/env python3
"""Create the "Open homes & availability" page the site chat reads.

    python3 shopify-app/create-inspections-page.py          # creates it if missing
    python3 shopify-app/create-inspections-page.py --show   # prints the live body

The Shopify Inbox agent answers from published pages, so this page is where
the chat learns open home times, auctions and which residences can be bought
(Naomi, 17 Sep 2026). After the first run the page is hers: she edits it in
Content > Pages > Open homes & availability. This script only creates the page
when it is missing and never overwrites what is there.
"""
import json, re, sys, os, urllib.request
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

HANDLE = 'inspections'
TITLE = 'Open homes & availability'

COLLECTION = ['ALHAMBRA', 'AMMOS', 'ARROL', 'AURA', 'BLANC', 'BRIS AV', 'CALLE', 'CASA PALMERA', 'EDEN', 'ENCANTO', 'FRASER', 'HAVEN', 'HERMOSA', 'JUDGE', 'KEMPSIE', 'KIRRA', 'LAUREL', 'LISLE', 'MILOS', 'NERO', 'PETRA', 'PLATEAU', 'SPECTRE', 'WHITE']

def home(name, address, open_homes, auction, agents):
    s = f'<h2>{name} - {address}</h2>\n<h3>Open homes</h3>\n'
    if open_homes:
        s += '<ul>\n' + ''.join(f'<li>{t}</li>\n' for t in open_homes) + '</ul>\n'
    else:
        s += '<p>None scheduled at the moment. Inspections are by private appointment.</p>\n'
    s += f'<h3>Auction</h3>\n<p>{auction or "No auction scheduled."}</p>\n'
    if agents:
        s += f'<p>Selling agent{"s" if " and " in agents else ""}: {agents}.</p>\n'
    s += '<p>If none of these times suit, leave your name and phone number and we will arrange a private inspection.</p>\n'
    return s

BODY = (
    '<p>Open homes, auctions and which Sabdia residences can be bought today. Times that have passed no longer apply.</p>\n'
    '<h2>Available to buy</h2>\n'
    '<p>These residences are for sale: QASR in Coorparoo, SOLACE in Camp Hill, SIERRA in Holland Park West, CASPIAN in Ascot and AETHER in Hendra.</p>\n'
    '<h2>Not available</h2>\n<ul>\n'
    '<li>CAPRI, 8 Dagmar Street, Holland Park West - sold prior to completion.</li>\n'
    f'<li>The Collection: {", ".join(COLLECTION)}. These are completed homes that have been sold and are privately owned. They are not for sale and cannot be inspected.</li>\n'
    '</ul>\n'
    '<p>A residence sold off market, sold prior to completion or shown in The Collection cannot be bought. We can let you know first about our upcoming releases instead.</p>\n'
    + home('AETHER', '30 Matong Street, Hendra', [
        'Thursday 17 September 2026, 5:00 to 5:30pm',
        'Saturday 19 September 2026, 9:00 to 9:30am',
        'Saturday 19 September 2026, 12:00 to 12:30pm',
    ], 'Saturday 10 October 2026, starting at 9:00am.', 'Matt Lancashire and Nick Kouparitsas')
    + home('SIERRA', '6 Dagmar Street, Holland Park West', [], None, 'Michael Bacon')
    + home('SOLACE', '96 Newman Avenue, Camp Hill', [], None, 'Will Torres, Torres Property')
    + home('CASPIAN', '79 Lapraik Street, Ascot', [], None, None)
    + home('QASR', '119 Buena Vista Avenue, Coorparoo', [], None, None)
)

found = gql('query($q:String!){ pages(first:5, query:$q){ nodes{ id handle title isPublished body } } }', {"q": f"handle:{HANDLE}"})['pages']['nodes']
found = [p for p in found if p['handle'] == HANDLE]
if '--show' in sys.argv:
    print(found[0]['body'] if found else 'No page yet.')
    sys.exit()
if found:
    print(f"Already there ({found[0]['title']}, published={found[0]['isPublished']}) - left as it is.")
    sys.exit()
res = gql('mutation($p:PageCreateInput!){ pageCreate(page:$p){ page{ id handle title isPublished } userErrors{ field message } } }',
          {"p": {"title": TITLE, "handle": HANDLE, "body": BODY, "isPublished": True}})['pageCreate']
if res['userErrors']: sys.exit(res['userErrors'])
print(f"Created /pages/{res['page']['handle']} ({res['page']['title']}, published={res['page']['isPublished']})")
