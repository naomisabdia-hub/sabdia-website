#!/usr/bin/env python3
"""Give every card of the home page's Properties grid (Current Residences)
its own Residence card block, so a card can be clicked in the theme editor
and its photo, link or crop changed by hand - the way the residence
Gallery's photos are blocks (Naomi, 14 Sep 2026).

Pulls templates/index.json from a theme (store-side: Naomi's customizer
edits live there), and where the Properties grid section has no card
blocks yet, adds one per residence in the order the grid drew them
automatically: the For Sale collection's drag order, other live residences,
then the Sold collection's order and other sold ones (Status decides live or
sold, as residence-status does), leaving out the "Leave out" residence and
stopping at "Most residences to show". Each block's Photo is set to the
residence's main photo, so the photo is there to swap. A grid that already
has blocks keeps them; only a block whose Photo is empty gets one.

  python3 shopify-app/add-residence-card-blocks.py 150783361126   # staging
  python3 shopify-app/add-residence-card-blocks.py 150554902630   # live (Naomi)
"""
import json, os, re, shutil, subprocess, sys, tempfile, urllib.request

STORE = "b91p0j-f4.myshopify.com"
LIVE = "150554902630"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

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

def status(p):
    st = ((p.get("status") or {}).get("value") or "").strip()
    if not st:
        st = "Sold Prior to Completion" if "sold" in [t.lower() for t in p["tags"]] else "For Sale"
    return st

def ordered(settings):
    """Handles in the grid's automatic order."""
    d = gql("""{ products(first: 100) { nodes { handle tags status: metafield(namespace: "custom", key: "status") { value } } } }""")
    prods = d["products"]["nodes"]
    live = [p["handle"] for p in prods if "Sold" not in status(p)]
    sold = [p["handle"] for p in prods if "Sold" in status(p)]
    def col(handle):
        if not handle:
            return []
        c = gql("""query($h: String!) { collectionByHandle(handle: $h) { products(first: 100) { nodes { handle } } } }""", {"h": handle})
        c = c.get("collectionByHandle")
        return [n["handle"] for n in c["products"]["nodes"]] if c else []
    def group(col_handle, members):
        out = [h for h in col(col_handle) if h in members]
        out += [h for h in members if h not in out]
        return out
    lives = [h for h in group(settings.get("for_sale_collection"), live) if h != settings.get("exclude")]
    solds = group(settings.get("sold_collection"), sold) if settings.get("include_sold", True) else []
    return (lives + solds)[: int(settings.get("max_cards", 12))]

def main_photo(handle):
    d = gql("""query($q: String!) { products(first: 1, query: $q) { nodes { featuredImage { url } } } }""", {"q": f"handle:{handle}"})
    n = d["products"]["nodes"]
    u = (n[0].get("featuredImage") or {}).get("url") if n else None
    return "shopify://shop_images/" + u.split("?")[0].rsplit("/", 1)[-1] if u else None

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    theme = sys.argv[1]
    env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=env_val("SHOPIFY_CLI_THEME_TOKEN"))
    work = tempfile.mkdtemp(prefix="card-blocks-")
    rel = "templates/index.json"
    sh("shopify", "theme", "pull", "--store", STORE, "--theme", theme, "--path", work, "--only", rel, env=env)
    path = os.path.join(work, rel)
    raw = open(path).read()
    body = re.sub(r"^\s*/\*.*?\*/\s*", "", raw, count=1, flags=re.S)
    data = json.loads(body)
    sec = next((s for s in data["sections"].values() if s.get("type") == "properties-grid"), None)
    if sec is None:
        print("No Properties grid on the home page."); shutil.rmtree(work); return
    if sec.get("blocks"):
        filled = 0
        for b in sec["blocks"].values():
            st = b.setdefault("settings", {})
            if b.get("type") == "card" and st.get("residence") and not st.get("image"):
                img = main_photo(st["residence"])
                if img:
                    st["image"] = img; filled += 1
        if not filled:
            print("The grid already has card blocks, photos set - nothing to do."); shutil.rmtree(work); return
        print(f"{filled} block(s) given the residence's main photo")
        handles = []
    else:
        handles = ordered(sec.get("settings", {}))
        if not handles:
            print("No residences found."); shutil.rmtree(work); return
        sec["blocks"] = {f"card_{h}": {"type": "card", "settings": {"residence": h, "image": main_photo(h), "focus": "center"}} for h in handles}
        sec["block_order"] = [f"card_{h}" for h in handles]
    open(path, "w").write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    args = ["shopify", "theme", "push", "--store", STORE, "--theme", theme, "--path", work, "--nodelete", "--force", "--only", rel]
    if theme == LIVE:
        args.append("--allow-live")
    sh(*args, env=env)
    shutil.rmtree(work)
    print("Residence card blocks:", ", ".join(handles) or "photos filled in")

if __name__ == "__main__":
    main()
