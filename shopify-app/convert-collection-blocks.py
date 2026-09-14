#!/usr/bin/env python3
"""Point the Collection page's Residence blocks at the residences that now
live in Products (14 Sep 2026: MILOS, PETRA, KIRRA, HERMOSA, ENCANTO), so
the card fills from the product (name, suburb, style, main photo, link to
the residence page) instead of the old Collection page and its photos on
Supabase. Adds Residence blocks for the residences that never had a page
(HAVEN, SPECTRE). Idempotent; pushes only when something changed.

    python3 shopify-app/convert-collection-blocks.py 150783361126   # staging
    python3 shopify-app/convert-collection-blocks.py 150554902630   # live (Naomi)
"""
import json, os, re, shutil, subprocess, sys, tempfile

STORE = "b91p0j-f4.myshopify.com"
LIVE = "150554902630"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONVERTED = ("milos", "petra", "kirra", "hermosa", "encanto")
NEW = ("haven", "spectre")
REL = "templates/page.collection.json"


def env_val(key):
    for line in open(os.path.join(ROOT, ".env")):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(f"{key} missing from .env")


def sh(*args, **kw):
    print("$", " ".join(args))
    return subprocess.run(args, check=True, **kw)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    theme = sys.argv[1]
    env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=env_val("SHOPIFY_CLI_THEME_TOKEN"))
    work = tempfile.mkdtemp(prefix="collection-blocks-")
    sh("shopify", "theme", "pull", "--store", STORE, "--theme", theme, "--path", work, "--only", REL, env=env)
    path = os.path.join(work, REL)
    if not os.path.exists(path):
        sys.exit(f"{REL} is not on theme {theme}")
    raw = open(path).read()
    data = json.loads(re.sub(r"^\s*/\*.*?\*/\s*", "", raw, count=1, flags=re.S))
    sec = next((s for s in data["sections"].values() if s.get("type") == "portfolio-grid"), None)
    if sec is None:
        sys.exit("no Collection grid section on the page")
    blocks, order = sec.setdefault("blocks", {}), sec.setdefault("block_order", [])
    changed = False
    have = set()
    for bid in order:
        b = blocks[bid]
        if b.get("type") != "residence":
            continue
        st = b.setdefault("settings", {})
        page = (st.get("page") or "").strip()
        link = st.get("link") or ""
        h = page[len("collection-"):] if page.startswith("collection-") else ""
        if not h and "/pages/collection-" in link:
            h = link.split("/pages/collection-", 1)[1].split("?")[0].split("#")[0].strip("/")
        if st.get("product"):
            have.add(st["product"])
        if h in CONVERTED and st.get("product") != h:
            st["product"] = h
            # The old page's photo and link no longer lead; the product's do.
            if link.startswith("/pages/collection-"):
                st["link"] = ""
            changed = True
            print(f"  {bid}: -> product {h}")
        if st.get("product"):
            have.add(st["product"])
    for h in NEW:
        if h in have:
            continue
        bid = f"residence_{h}"
        while bid in blocks:
            bid += "_"
        blocks[bid] = {"type": "residence", "settings": {"product": h}}
        order.append(bid)
        changed = True
        print(f"  added {bid} (product {h})")
    if not changed:
        print("Nothing to change."); shutil.rmtree(work); return
    open(path, "w").write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    args = ["shopify", "theme", "push", "--store", STORE, "--theme", theme, "--path", work, "--nodelete", "--force", "--only", REL]
    if theme == LIVE:
        args.append("--allow-live")
    sh(*args, env=env)
    shutil.rmtree(work)
    print("Collection grid blocks updated.")


if __name__ == "__main__":
    main()
