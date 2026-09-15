#!/usr/bin/env python3
"""Give each residence for sale its own Shopify PAGE, copied from its product.

    python3 shopify-app/make-residence-pages.py            # all six
    python3 shopify-app/make-residence-pages.py qasr aether
    python3 shopify-app/make-residence-pages.py --update qasr   # recopy an existing page

Naomi, 15 Sep 2026: a $0 price must not appear anywhere, and every Shopify
product has a price, so the residences move from products to pages that
look exactly the same. This script does the store side and changes no
product:

1. Page metafield definitions for every product field a residence page
   reads (suburb, status, build size, enquiry wording, name font...), same
   namespace, key and type as the product definitions, so the theme reads
   page.metafields.custom.<key> exactly as it read the product's.
2. One page per residence at /pages/<handle> (same handle as the product):
   title, description (page body), search engine title/description and
   every custom.* metafield copied from the product. A page that already
   exists is left exactly as it is (it is the residence now, edited in
   Content › Pages) unless --update is given.

The page template (templates/page.residence-<handle>.json) is assigned
at switch-over, once the live theme carries it; until then preview with
/pages/<handle>?view=residence-<handle>.
"""
import json, os, re, sys, urllib.request

HANDLES = ['qasr', 'solace', 'sierra', 'caspian', 'aether', 'capri']
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATHS = [os.path.join(ROOT, '.env'), os.path.expanduser('~/Desktop/New sabdia website/.env')]
env = {}
for path in ENV_PATHS:
    if os.path.exists(path):
        for line in open(path):
            m = re.match(r'^([A-Z_]+)=(.*)$', line.strip())
            if m:
                env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
        break
STORE, TOKEN = env['SHOPIFY_STORE'], env['SHOPIFY_ADMIN_TOKEN']
API = f"https://{STORE}/admin/api/2025-07/graphql.json"


def gql(query, variables=None):
    req = urllib.request.Request(API, data=json.dumps({"query": query, "variables": variables or {}}).encode(),
                                 headers={"X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json"})
    out = json.load(urllib.request.urlopen(req))
    if out.get('errors'):
        sys.exit(f"API error: {out['errors']}")
    return out['data']


def ensure_page_definitions():
    prod = gql('{ metafieldDefinitions(ownerType: PRODUCT, first: 100, namespace: "custom"){ nodes{ key name type{ name } } } }')['metafieldDefinitions']['nodes']
    page = gql('{ metafieldDefinitions(ownerType: PAGE, first: 100, namespace: "custom"){ nodes{ key type{ name } } } }')['metafieldDefinitions']['nodes']
    have = {d['key']: d['type']['name'] for d in page}
    for d in prod:
        if d['key'] in have:
            if have[d['key']] != d['type']['name']:
                print(f"  ! page custom.{d['key']} is {have[d['key']]}, product is {d['type']['name']} - left as is")
            continue
        r = gql('mutation($d: MetafieldDefinitionInput!){ metafieldDefinitionCreate(definition: $d){ createdDefinition{ key } userErrors{ field message } } }',
                {"d": {"name": d['name'], "namespace": "custom", "key": d['key'], "type": d['type']['name'], "ownerType": "PAGE", "pin": True}})['metafieldDefinitionCreate']
        if r['userErrors']:
            sys.exit(f"definition custom.{d['key']}: {r['userErrors']}")
        print(f"  + page field custom.{d['key']} ({d['type']['name']})")


def copy_residence(handle):
    p = gql('query($q: String!){ products(first: 1, query: $q){ nodes{ id handle title descriptionHtml seo{ title description } metafields(first: 100){ nodes{ namespace key type value } } } } }',
            {"q": f"handle:{handle}"})['products']['nodes']
    if not p or p[0]['handle'] != handle:
        sys.exit(f"No product '{handle}'")
    p = p[0]
    fields = [{"namespace": m['namespace'], "key": m['key'], "type": m['type'], "value": m['value']}
              for m in p['metafields']['nodes'] if m['namespace'] == 'custom']
    if p['seo']['title']:
        fields.append({"namespace": "global", "key": "title_tag", "type": "single_line_text_field", "value": p['seo']['title']})
    if p['seo']['description']:
        fields.append({"namespace": "global", "key": "description_tag", "type": "single_line_text_field", "value": p['seo']['description']})
    existing = gql('query($q: String!){ pages(first: 5, query: $q){ nodes{ id handle } } }', {"q": f"handle:{handle}"})['pages']['nodes']
    existing = [e for e in existing if e['handle'] == handle]
    page_input = {"title": p['title'], "body": p['descriptionHtml'], "isPublished": True, "metafields": fields}
    if existing and not UPDATE:
        print(f"  /pages/{handle} exists - left as it is (--update recopies it from the product)")
        return
    if existing:
        r = gql('mutation($id: ID!, $p: PageUpdateInput!){ pageUpdate(id: $id, page: $p){ page{ id handle } userErrors{ field message } } }',
                {"id": existing[0]['id'], "p": page_input})['pageUpdate']
        verb = 'updated'
    else:
        page_input['handle'] = handle
        r = gql('mutation($p: PageCreateInput!){ pageCreate(page: $p){ page{ id handle } userErrors{ field message } } }',
                {"p": page_input})['pageCreate']
        verb = 'created'
    if r['userErrors']:
        sys.exit(f"{handle}: {r['userErrors']}")
    print(f"  {verb} /pages/{r['page']['handle']} from product {p['title']} ({len(fields)} fields)")


UPDATE = '--update' in sys.argv


def main():
    handles = [a for a in sys.argv[1:] if not a.startswith('--')] or HANDLES
    print("Page fields:")
    ensure_page_definitions()
    print("Residence pages:")
    for h in handles:
        copy_residence(h)


if __name__ == '__main__':
    main()
