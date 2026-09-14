#!/usr/bin/env python3
"""Take the completed residences (the Collection homes that now live in
Products) off the storefront while the theme learns their "Completed"
status, or put them back.

    python3 shopify-app/hide-completed-residences.py hide
    python3 shopify-app/hide-completed-residences.py show

hide = product status Draft (the page 404s, every list skips it; the old
/pages/collection-… page keeps serving). show = Active again.
"""
import json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HANDLES = ("milos", "petra", "kirra", "hermosa", "encanto", "haven", "spectre")


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
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode not in ("hide", "show"):
        sys.exit(__doc__)
    status = "DRAFT" if mode == "hide" else "ACTIVE"
    for h in HANDLES:
        p = gql('query($h:String!){ productByHandle(handle:$h){ id } }', {"h": h})["productByHandle"]
        if not p:
            print(f"{h}: no product"); continue
        d = gql('mutation($p: ProductUpdateInput!){ productUpdate(product:$p){ product{ handle status } userErrors{ message } } }',
                {"p": {"id": p["id"], "status": status}})["productUpdate"]
        print(h, d["product"]["status"] if d["product"] else d["userErrors"])


if __name__ == "__main__":
    main()
