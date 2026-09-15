#!/usr/bin/env python3
"""Give each completed residence's page its own template (14 Sep 2026):
Content › Pages › MILOS gets theme template collection-milos, and so on,
so the Photo blocks and pickers in its Collection residence section are
its own. Creates the HAVEN and SPECTRE pages (they never had one) with
their story, style and suburb. CALLE, ELYSIUM and NERO (15 Sep 2026) move
off the shared collection-item template so their Series Post blocks are
their own (add-series-blocks.py creates those templates). Run only once the
theme carrying page.collection-<handle>.json is live (push-live.sh does).

    python3 shopify-app/assign-collection-templates.py
"""
import json, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXISTING = ("milos", "petra", "kirra", "hermosa", "encanto", "ammos", "alhambra", "calle", "elysium", "nero")
NEW = {
    "haven": dict(title="HAVEN", loc="Camp Hill QLD, Australia", style="Hamptons", year=None,
                  headline="Weatherboard and arches, <em>in Camp Hill</em>.",
                  teaser="White weatherboard, gabled rooflines and arched openings.",
                  story="HAVEN is a Hamptons-inspired residence in Camp Hill: white weatherboard under gabled rooflines, arched openings and a natural stone entry wall, with the living rooms opening to a pool and covered alfresco at the rear.\nDesigned, developed and built in-house by Sabdia."),
    "spectre": dict(title="SPECTRE", loc="Camp Hill QLD, Australia", style="Contemporary", year=2020,
                    headline="Screens and stone, <em>in Camp Hill</em>.",
                    teaser="A translucent screened upper level over a natural stone base.",
                    story="SPECTRE is a contemporary residence in Camp Hill: a translucent screened upper level floating over a natural stone base, with the kitchen, dining and living rooms wrapped around a private pool courtyard.\nDesigned, developed and built in-house by Sabdia."),
    "eden": dict(title="EDEN", loc="Brisbane QLD, Australia", style="Hamptons", year=None,
                 headline="Weatherboard and light, <em>in Brisbane</em>.",
                 teaser="White weatherboard, a gabled front and pale timber joinery.",
                 story="EDEN is a Hamptons-inspired residence: white weatherboard under a gabled front, with pale timber joinery, fluted tiles and a farmhouse sink in a light-filled kitchen.\nDesigned, developed and built in-house by Sabdia."),
}


def env_val(key):
    for line in open(os.path.join(ROOT, ".env")):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(f"{key} missing from .env")


def gql(q, v=None):
    r = urllib.request.Request(f"https://{env_val('SHOPIFY_STORE')}/admin/api/2025-07/graphql.json", data=json.dumps({"query": q, "variables": v or {}}).encode(),
                               headers={"X-Shopify-Access-Token": env_val("SHOPIFY_ADMIN_TOKEN"), "Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(r))
    if d.get("errors"):
        sys.exit(json.dumps(d["errors"], indent=2))
    return d["data"]


def page(handle):
    n = gql('query($q:String!){ pages(first:1, query:$q){ nodes{ id handle templateSuffix isPublished } } }', {"q": f"handle:{handle}"})["pages"]["nodes"]
    return next((p for p in n if p["handle"] == handle), None)


def main():
    for h in EXISTING + tuple(NEW):
        pg = page(f"collection-{h}")
        suffix = f"collection-{h}"
        if pg:
            if pg["templateSuffix"] == suffix:
                print(f"{h}: already on {suffix}"); continue
            d = gql('mutation($id: ID!, $page: PageUpdateInput!){ pageUpdate(id:$id, page:$page){ page{ handle templateSuffix } userErrors{ message } } }',
                    {"id": pg["id"], "page": {"templateSuffix": suffix}})["pageUpdate"]
            print(h, d["page"] or d["userErrors"])
        elif h in NEW:
            r = NEW[h]
            mf = [("loc", "single_line_text_field", r["loc"]), ("style", "single_line_text_field", r["style"]),
                  ("headline", "single_line_text_field", r["headline"]), ("teaser", "single_line_text_field", r["teaser"]),
                  ("story", "multi_line_text_field", r["story"])]
            if r.get("year"):
                mf.append(("year", "number_integer", str(r["year"])))
            body = f"<p>{r['title']} - {r['loc']}.</p>"
            d = gql('mutation($page: PageCreateInput!){ pageCreate(page:$page){ page{ id handle templateSuffix } userErrors{ field message } } }',
                    {"page": {"title": r["title"], "handle": f"collection-{h}", "body": body, "templateSuffix": suffix, "isPublished": True,
                              "metafields": [{"namespace": "custom", "key": k, "type": t, "value": v} for k, t, v in mf]}})["pageCreate"]
            print(h, "created", d["page"] or d["userErrors"])
        else:
            print(f"{h}: no page")


if __name__ == "__main__":
    main()
