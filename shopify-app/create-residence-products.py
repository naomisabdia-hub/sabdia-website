#!/usr/bin/env python3
"""Create (or refresh) the completed residences as products, so each has the
residence page (Header, Property page, About and enquiry, The residence,
Private appointments, The film, The Series, More Sabdia residences) and a
Media folder of its own in the file picker (14 Sep 2026: MILOS, PETRA,
KIRRA, HERMOSA, ENCANTO, HAVEN, SPECTRE).

    python3 shopify-app/create-residence-products.py            # all
    python3 shopify-app/create-residence-products.py milos petra

Story, headline, style, teaser and The Series posts come across from the
old Collection page of the same name where one exists. Status = Completed, a
group the For Sale, Sold and home lists all skip: a completed residence
appears on the Collection page only. Pass --publish to put new products
on the Online Store (do that once the theme knows the Completed status). Idempotent: an
existing product only has its metafields refreshed.
"""
import json, re, sys, urllib.request, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = {}
for line in open(os.path.join(ROOT, '.env')):
    m = re.match(r'^([A-Z_]+)=(.*)$', line.strip())
    if m:
        env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
STORE, TOKEN = env['SHOPIFY_STORE'], env['SHOPIFY_ADMIN_TOKEN']
API = f"https://{STORE}/admin/api/2025-07/graphql.json"


def gql(query, variables=None):
    req = urllib.request.Request(API, data=json.dumps({"query": query, "variables": variables or {}}).encode(),
                                 headers={"X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json"})
    out = json.load(urllib.request.urlopen(req))
    if out.get('errors'):
        sys.exit(f"API error: {json.dumps(out['errors'], indent=1)}")
    return out['data']


# One entry per residence. Words follow docs/VOICE-GUIDE.md: materials first,
# no counts, no em dashes.
RESIDENCES = {
    "milos": dict(title="MILOS", suburb="Camp Hill", style="Mediterranean", year=2025,
                  headline="Modern Mediterranean, <em>in Camp Hill</em>.",
                  teaser="Arched openings, warm textures and a sun-washed palette.",
                  story=["Modern Mediterranean in form and spirit, MILOS brings arched openings, warm textures and a sun-washed palette to a quiet Camp Hill street.",
                         "Flowing living spaces and a seamless indoor-outdoor connection carry the light through the home, with refined detailing and soft, sculptural elements throughout.",
                         "An architectural expression of warmth and intention."],
                  seo="MILOS, Camp Hill. A completed Sabdia residence: flowing living spaces and a seamless indoor-outdoor connection, designed, developed and built in-house."),
    "petra": dict(title="PETRA", suburb="Taringa", style="Palm Springs", year=None,
                  headline="Palm Springs, <em>in Taringa</em>.",
                  teaser="Palm Springs influence, reinterpreted through a refined, architectural lens.",
                  story=["PETRA brings a Palm Springs influence to Taringa, reinterpreted through a refined, architectural lens.",
                         "Natural stone, timber battens and a curved facade sit under a low, wide roofline, with the planting doing as much of the work as the walls.",
                         "Designed, developed and built in-house by Sabdia."],
                  seo="PETRA, Taringa. A completed Sabdia residence: Palm Springs influence, reinterpreted through a refined, architectural lens."),
    "kirra": dict(title="KIRRA", suburb="Holland Park", style="Contemporary", year=None,
                  headline="Battens and stone, <em>in Holland Park</em>.",
                  teaser="A battened upper level over a natural stone base.",
                  story=["KIRRA is a contemporary residence with a white, battened upper level set over a natural stone base and a timber-clad garage, the facade reading as a single, calm composition.",
                         "Designed, developed and built in-house by Sabdia."],
                  seo="KIRRA, Holland Park. A completed Sabdia residence: a battened upper level over a natural stone base, designed, developed and built in-house."),
    "hermosa": dict(title="HERMOSA", suburb="Camp Hill", style="Mediterranean", year=None,
                    headline="Arches, <em>in Camp Hill</em>.",
                    teaser="White render, a run of arched openings and a natural stone base.",
                    story=["HERMOSA is a Mediterranean residence in Camp Hill: white render, a run of arched openings across the upper level, and a natural stone base that grounds the home to its street.",
                           "Designed, developed and built in-house by Sabdia."],
                    seo="HERMOSA, Camp Hill. A completed Sabdia residence: white render, arched openings and a natural stone base, designed, developed and built in-house."),
    "encanto": dict(title="ENCANTO", suburb="Camp Hill", style="Palm Springs", year=None,
                    headline="Curves and battens, <em>in Camp Hill</em>.",
                    teaser="Curved render, timber battens and stacked natural stone.",
                    story=["ENCANTO brings a Palm Springs influence to Camp Hill: curved render, timber battens and stacked natural stone, set behind a lawn and a single palm.",
                           "Designed, developed and built in-house by Sabdia."],
                    seo="ENCANTO, Camp Hill. A completed Sabdia residence: curved render, timber battens and stacked natural stone, designed, developed and built in-house."),
    "haven": dict(title="HAVEN", suburb="Camp Hill", style="Hamptons", year=None,
                  headline="Weatherboard and arches, <em>in Camp Hill</em>.",
                  teaser="White weatherboard, gabled rooflines and arched openings.",
                  story=["HAVEN is a Hamptons-inspired residence in Camp Hill: white weatherboard under gabled rooflines, arched openings and a natural stone entry wall, with the living rooms opening to a pool and covered alfresco at the rear.",
                         "Designed, developed and built in-house by Sabdia."],
                  seo="HAVEN, Camp Hill. A completed Sabdia residence: white weatherboard, gabled rooflines and arched openings, designed, developed and built in-house."),
    "spectre": dict(title="SPECTRE", suburb="Camp Hill", style="Contemporary", year=2020,
                    headline="Screens and stone, <em>in Camp Hill</em>.",
                    teaser="A translucent screened upper level over a natural stone base.",
                    story=["SPECTRE is a contemporary residence in Camp Hill: a translucent screened upper level floating over a natural stone base, with the kitchen, dining and living rooms wrapped around a private pool courtyard.",
                           "Designed, developed and built in-house by Sabdia."],
                    seo="SPECTRE, Camp Hill. A completed Sabdia residence: a screened upper level over a natural stone base, designed, developed and built in-house."),
}


def page_posts(handle):
    d = gql('query($q:String!){ pages(first:1, query:$q){ nodes{ handle metafield(namespace:"custom", key:"series_posts"){ value } } } }', {"q": f"handle:collection-{handle}"})
    n = d['pages']['nodes']
    if n and n[0]['handle'] == f"collection-{handle}" and n[0]['metafield']:
        return n[0]['metafield']['value']
    return None


def metafields(h, r):
    name = r['title']
    mf = [("suburb", "single_line_text_field", r['suburb']), ("state", "single_line_text_field", "Queensland"),
          ("status", "single_line_text_field", "Completed"), ("style", "single_line_text_field", r['style']),
          ("teaser", "single_line_text_field", r['teaser']), ("headline", "single_line_text_field", r['headline']),
          ("show_walkthrough", "boolean", "false"),
          ("enquiry_heading", "single_line_text_field", "Register for Upcoming Releases"),
          ("enquiry_text", "multi_line_text_field", f"{name} has found its owner. Register your interest to hear about upcoming Sabdia releases before they reach the market."),
          ("enquiry_button", "single_line_text_field", "Register Interest")]
    if r.get('year'):
        mf.append(("year", "number_integer", str(r['year'])))
    posts = page_posts(h)
    if posts:
        mf.append(("series_posts", "json", posts))
    return [{"namespace": "custom", "key": k, "type": t, "value": v} for k, t, v in mf]


def main():
    publish = "--publish" in sys.argv
    want = [a for a in sys.argv[1:] if a != "--publish"] or list(RESIDENCES)
    pubs = gql("query { publications(first: 10) { nodes { id name } } }")["publications"]["nodes"]
    online = next((p for p in pubs if "online" in (p.get("name") or "").lower()), None)
    for h in want:
        r = RESIDENCES[h]
        body = "".join(f"<p>{p}</p>" for p in r['story'])
        existing = gql('query($h:String!){ productByHandle(handle:$h){ id } }', {"h": h})['productByHandle']
        p_in = {"title": r['title'], "handle": h, "templateSuffix": h, "descriptionHtml": body,
                "tags": ["sold", "completed"], "productType": "Residence", "vendor": "Sabdia",
                "seo": {"title": f"{r['title']} | Sabdia", "description": r['seo']}, "metafields": metafields(h, r)}
        if existing:
            p_in["id"] = existing['id']
            d = gql('mutation($p: ProductUpdateInput!){ productUpdate(product:$p){ product{ id handle } userErrors{ field message } } }', {"p": p_in})['productUpdate']
            what = "updated"
        else:
            d = gql('mutation($p: ProductCreateInput!){ productCreate(product:$p){ product{ id handle } userErrors{ field message } } }', {"p": p_in})['productCreate']
            what = "created"
        if d['userErrors']:
            sys.exit(f"{h}: {d['userErrors']}")
        pid = d['product']['id']
        if online and publish:
            pu = gql('mutation($id: ID!, $input: [PublicationInput!]!){ publishablePublish(id:$id, input:$input){ userErrors{ message } } }',
                     {"id": pid, "input": [{"publicationId": online['id']}]})['publishablePublish']
            if pu['userErrors'] and not any('already' in u['message'].lower() for u in pu['userErrors']):
                print(f"  publish: {pu['userErrors']}")
        print(f"{h}: {what} {pid} (template product.{h}, Status Completed{', published to ' + online['name'] if online and publish else ''})")


if __name__ == '__main__':
    main()
