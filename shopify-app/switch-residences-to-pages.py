#!/usr/bin/env python3
"""Switch the residences for sale over to their pages on the store.

    python3 shopify-app/switch-residences-to-pages.py                  # templates + forwarding
    python3 shopify-app/switch-residences-to-pages.py --draft-products # and hide the $0 products

Run after the theme push that carries templates/page.residence-<handle>.json
and templates/product.to-page.json (push-live.sh does both, in order).
15 Sep 2026, Naomi: every Shopify product has a price and a $0 price must
not appear anywhere, so QASR, SOLACE, SIERRA, CASPIAN, AETHER and CAPRI are
pages that look exactly as their product pages did.

1. Each page (/pages/<handle>, made by make-residence-pages.py) goes on its
   own template, page.residence-<handle> (a copy of its product template:
   every section, setting, gallery Photo block and Series Post block).
2. Each product goes on product.to-page, which forwards /products/<handle>
   to /pages/<handle> (noindex) while the product is still Active, so old
   links (agents, social, Google) land on the page.
3. A store URL redirect /products/<handle> -> /pages/<handle>, which takes
   over once a product is Draft (Shopify only redirects addresses that no
   longer resolve).
4. --draft-products: the six products go to Draft, off every channel, so no
   $0 price exists anywhere. Their photos and films stay in Products › Media
   and keep showing on the pages (tested 15 Sep 2026). Never delete them.
Idempotent: anything already in place is left alone.
"""
import json, os, re, sys, urllib.request
HANDLES = ['qasr', 'solace', 'sierra', 'caspian', 'aether', 'capri']
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = {}
for path in (os.path.join(ROOT, '.env'), os.path.expanduser('~/Desktop/New sabdia website/.env')):
    if os.path.exists(path):
        for line in open(path):
            m = re.match(r'^([A-Z_]+)=(.*)$', line.strip())
            if m:
                env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
        break
API = f"https://{env['SHOPIFY_STORE']}/admin/api/2025-07/graphql.json"
TOKEN = env['SHOPIFY_ADMIN_TOKEN']


def gql(query, variables=None):
    req = urllib.request.Request(API, data=json.dumps({"query": query, "variables": variables or {}}).encode(),
                                 headers={"X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json"})
    out = json.load(urllib.request.urlopen(req))
    if out.get('errors'):
        sys.exit(f"API error: {out['errors']}")
    return out['data']


def main():
    draft = '--draft-products' in sys.argv
    redirects = {r['path']: r['target'] for r in gql('{ urlRedirects(first: 250){ nodes{ path target } } }')['urlRedirects']['nodes']}
    for h in HANDLES:
        page = [n for n in gql('query($q:String!){ pages(first:5, query:$q){ nodes{ id handle templateSuffix } } }', {"q": f"handle:{h}"})['pages']['nodes'] if n['handle'] == h]
        if not page:
            print(f"  ! no page /pages/{h} - run make-residence-pages.py first"); continue
        page = page[0]
        want = f'residence-{h}'
        if page['templateSuffix'] != want:
            r = gql('mutation($id:ID!,$p:PageUpdateInput!){ pageUpdate(id:$id, page:$p){ page{ templateSuffix } userErrors{ message } } }', {"id": page['id'], "p": {"templateSuffix": want}})['pageUpdate']
            print(f"  /pages/{h} on page.{want}" if not r['userErrors'] else f"  ! /pages/{h}: {r['userErrors']}")
        prod = [n for n in gql('query($q:String!){ products(first:5, query:$q){ nodes{ id handle status templateSuffix } } }', {"q": f"handle:{h}"})['products']['nodes'] if n['handle'] == h]
        if prod:
            prod = prod[0]
            upd = {}
            if prod['templateSuffix'] != 'to-page':
                upd['templateSuffix'] = 'to-page'
            if draft and prod['status'] != 'DRAFT':
                upd['status'] = 'DRAFT'
            if upd:
                upd['id'] = prod['id']
                r = gql('mutation($p:ProductUpdateInput!){ productUpdate(product:$p){ product{ status templateSuffix } userErrors{ message } } }', {"p": upd})['productUpdate']
                print(f"  product {h}: {r['product']}" if not r['userErrors'] else f"  ! product {h}: {r['userErrors']}")
        path = f'/products/{h}'
        if path not in redirects:
            r = gql('mutation($r:UrlRedirectInput!){ urlRedirectCreate(urlRedirect:$r){ urlRedirect{ path target } userErrors{ message } } }', {"r": {"path": path, "target": f'/pages/{h}'}})['urlRedirectCreate']
            print(f"  redirect {path} -> /pages/{h}" if not r['userErrors'] else f"  ! redirect {path}: {r['userErrors']}")
    print("Done.")


if __name__ == '__main__':
    main()
