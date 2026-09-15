#!/usr/bin/env python3
"""Give every card on the For Sale page its own Residence block (Naomi,
15 Sep 2026: "the residences page under for sale - add the blocks where I
can also edit the info on the cards"), so a card can be clicked in the theme
editor and its photo, crop, name, status word, location, numbers or link
changed by hand for that card only.

Pulls templates/collection.json from a theme (store-side: Naomi's customizer
edits live there) and, where The residences (collection-grid) has no blocks
yet, adds one Residence block per residence in the order the grid drew them
automatically: the For Sale collection's drag order, then every other
residence whose Status is live (not Sold, not Completed). The Sold band
(collection-sold) gets one per sold residence the same way, the Sold
collection's order first. Each block's Card photo is the residence's main
photo, so the photo is there to swap. A section that already has blocks
keeps them untouched.

  python3 shopify-app/add-collection-card-blocks.py 150783361126   # staging
  python3 shopify-app/add-collection-card-blocks.py 150554902630   # live (Naomi)
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


def collection(handle):
    c = gql("""query($h: String!) { collectionByHandle(handle: $h) { products(first: 100) { nodes { handle } } } }""", {"h": handle})
    c = c.get("collectionByHandle")
    return [n["handle"] for n in c["products"]["nodes"]] if c else []


def residences():
    """(live handles, sold handles), each in the automatic order, with the main photo of every residence."""
    d = gql("""{ products(first: 100) { nodes { handle tags featuredImage { url }
              status: metafield(namespace: "custom", key: "status") { value } } } }""")
    prods = d["products"]["nodes"]
    photo = {}
    for p in prods:
        u = (p.get("featuredImage") or {}).get("url")
        photo[p["handle"]] = "shopify://shop_images/" + u.split("?")[0].rsplit("/", 1)[-1] if u else ""
    live = [p["handle"] for p in prods if "Sold" not in status(p) and "Completed" not in status(p)]
    sold = [p["handle"] for p in prods if "Sold" in status(p)]
    def group(col, members):
        out = [h for h in collection(col) if h in members]
        return out + [h for h in members if h not in out]
    return group("for-sale", live), group("sold", sold), photo


def fill(sec, handles, photo, what):
    if sec is None:
        print(f"  no {what} section on the For Sale page"); return False
    if sec.get("blocks"):
        print(f"  {what}: already has {len(sec['blocks'])} block(s), left alone"); return False
    if not handles:
        print(f"  {what}: no residences to list"); return False
    sec["blocks"] = {f"residence_{h}": {"type": "residence", "settings": {"product": h, "image": photo.get(h, ""), "focus": "center"}} for h in handles[:12]}
    sec["block_order"] = [f"residence_{h}" for h in handles[:12]]
    print(f"  {what}: {', '.join(handles[:12])}")
    return True


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    theme = sys.argv[1]
    env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=env_val("SHOPIFY_CLI_THEME_TOKEN"))
    work = tempfile.mkdtemp(prefix="collection-card-blocks-")
    rel = "templates/collection.json"
    sh("shopify", "theme", "pull", "--store", STORE, "--theme", theme, "--path", work, "--only", rel, env=env)
    path = os.path.join(work, rel)
    raw = open(path).read()
    data = json.loads(re.sub(r"^\s*/\*.*?\*/\s*", "", raw, count=1, flags=re.S))
    live, sold, photo = residences()
    grid = next((s for s in data["sections"].values() if s.get("type") == "collection-grid"), None)
    band = next((s for s in data["sections"].values() if s.get("type") == "collection-sold"), None)
    changed = fill(grid, live, photo, "The residences") | fill(band, sold, photo, "Sold band")
    if not changed:
        print("Nothing to push."); shutil.rmtree(work); return
    open(path, "w").write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    args = ["shopify", "theme", "push", "--store", STORE, "--theme", theme, "--path", work, "--nodelete", "--force", "--only", rel]
    if theme == LIVE:
        args.append("--allow-live")
    sh(*args, env=env)
    shutil.rmtree(work)
    print("Done.")


if __name__ == "__main__":
    main()
