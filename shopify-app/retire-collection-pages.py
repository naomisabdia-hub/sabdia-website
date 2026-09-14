#!/usr/bin/env python3
"""Unpublish the old Collection pages of the residences that now live in
Products (14 Sep 2026), so /pages/collection-milos and the rest follow
their redirects to /products/milos. Nothing is deleted: the page, its
metafields and its photo links stay in Content › Pages, unpublished.

    python3 shopify-app/retire-collection-pages.py          # unpublish
    python3 shopify-app/retire-collection-pages.py --undo   # publish again
"""
import json, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HANDLES = ("milos", "petra", "kirra", "hermosa", "encanto")


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


def main():
    publish = "--undo" in sys.argv
    for h in HANDLES:
        # The product must be live before its page steps aside.
        p = gql('query($h:String!){ productByHandle(handle:$h){ status } }', {"h": h})["productByHandle"]
        if not publish and (not p or p["status"] != "ACTIVE"):
            print(f"{h}: product not active yet, page left published"); continue
        pages = gql('query($q:String!){ pages(first:1, query:$q){ nodes{ id handle isPublished } } }', {"q": f"handle:collection-{h}"})["pages"]["nodes"]
        pg = next((x for x in pages if x["handle"] == f"collection-{h}"), None)
        if not pg:
            print(f"{h}: no page"); continue
        if pg["isPublished"] == publish:
            print(f"{h}: page already {'published' if publish else 'unpublished'}"); continue
        d = gql('mutation($id: ID!, $page: PageUpdateInput!){ pageUpdate(id:$id, page:$page){ page{ handle isPublished } userErrors{ message } } }',
                {"id": pg["id"], "page": {"isPublished": publish}})["pageUpdate"]
        print(h, d["page"] or d["userErrors"])


if __name__ == "__main__":
    main()
