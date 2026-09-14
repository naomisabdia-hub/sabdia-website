#!/usr/bin/env python3
"""Point the Collection page's Residence blocks at the completed residences'
photographs in Shopify (14 Sep 2026): each of MILOS, PETRA, KIRRA, HERMOSA,
ENCANTO keeps its page and its card photo becomes the main photo from that
residence's Media folder in Products (no Supabase); HAVEN and SPECTRE,
which never had a card, join the grid with their pages. Idempotent; pushes
only when something changed.

    python3 shopify-app/convert-collection-blocks.py 150783361126   # staging
    python3 shopify-app/convert-collection-blocks.py 150554902630   # live (Naomi)
"""
import json, os, re, shutil, subprocess, sys, tempfile, urllib.request

STORE = "b91p0j-f4.myshopify.com"
LIVE = "150554902630"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONVERTED = ("milos", "petra", "kirra", "hermosa", "encanto", "ammos", "alhambra")
NEW = ("haven", "spectre", "eden")
REL = "templates/page.collection.json"


def env_val(key):
    for line in open(os.path.join(ROOT, ".env")):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(f"{key} missing from .env")


def gql(q, v=None):
    r = urllib.request.Request(f"https://{STORE}/admin/api/2025-07/graphql.json", data=json.dumps({"query": q, "variables": v or {}}).encode(),
                               headers={"X-Shopify-Access-Token": env_val("SHOPIFY_ADMIN_TOKEN"), "Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(r))
    if d.get("errors"):
        sys.exit(json.dumps(d["errors"], indent=2))
    return d["data"]


def sh(*args, **kw):
    print("$", " ".join(args))
    return subprocess.run(args, check=True, **kw)


def hero(handle):
    d = gql('query($h:String!){ productByHandle(handle:$h){ featuredImage{ url } } }', {"h": handle})["productByHandle"]
    if not d or not d.get("featuredImage"):
        return None
    return d["featuredImage"]["url"].split("?")[0].rsplit("/", 1)[-1]


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    theme = sys.argv[1]
    env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=env_val("SHOPIFY_CLI_THEME_TOKEN"))
    heroes = {h: hero(h) for h in CONVERTED + NEW}
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
        h = page[len("collection-"):] if page.startswith("collection-") else (st.get("product") or "")
        if not h and "/pages/collection-" in link:
            h = link.split("/pages/collection-", 1)[1].split("?")[0].split("#")[0].strip("/")
        if h in heroes and heroes[h]:
            want = {"page": f"collection-{h}", "image": "shopify://shop_images/" + heroes[h]}
            if any(st.get(k) != v for k, v in want.items()) or st.get("product"):
                st.update(want); st.pop("product", None)
                changed = True
                print(f"  {bid}: page collection-{h}, photo {heroes[h]}")
        if h:
            have.add(h)
    for h in NEW:
        if h in have or not heroes.get(h):
            continue
        bid = f"residence_{h}"
        while bid in blocks:
            bid += "_"
        blocks[bid] = {"type": "residence", "settings": {"page": f"collection-{h}", "image": "shopify://shop_images/" + heroes[h]}}
        order.append(bid)
        changed = True
        print(f"  added {bid} (page collection-{h})")
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
