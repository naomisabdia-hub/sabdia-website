#!/usr/bin/env python3
"""Give every photo of a residence's Gallery its own Photo block on the six
residence page templates, so a photo can be clicked in the theme editor and
swapped, captioned or reordered (Naomi, 14 Sep 2026: "each photo is a block").

Pulls the product templates from a theme (store-side: Naomi's customizer
edits live there); where the Gallery section has no blocks yet, adds one
Photo block per photo on the residence (Products › the residence › Media, in
order, after the main photo - the gallery never repeats the header photo),
pointing at the same file, and pushes just those templates back. Captions
keep coming from each photo's alt text until a block's Caption is typed. A
gallery that already has blocks is left exactly as it is. Shopify allows 50
blocks per section; photos beyond that are skipped with a note.

  python3 shopify-app/add-gallery-photo-blocks.py 150783361126   # staging
  python3 shopify-app/add-gallery-photo-blocks.py 150554902630   # live (Naomi)
"""
import json, os, re, shutil, subprocess, sys, tempfile, urllib.request

STORE = "b91p0j-f4.myshopify.com"
LIVE = "150554902630"
MAX_BLOCKS = 50
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HANDLES = ("qasr", "solace", "sierra", "caspian", "aether", "capri", "milos", "petra", "kirra", "hermosa", "encanto", "haven", "spectre")

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

def photos(handle):
    d = gql("""query($q: String!) { products(first: 1, query: $q) { nodes { images(first: 100) { nodes { url } } } } }""", {"q": f"handle:{handle}"})
    n = d["products"]["nodes"]
    return [u["url"].split("?")[0].rsplit("/", 1)[-1] for u in n[0]["images"]["nodes"]] if n else []

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    theme = sys.argv[1]
    env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=env_val("SHOPIFY_CLI_THEME_TOKEN"))
    work = tempfile.mkdtemp(prefix="gallery-blocks-")
    files = [f"templates/product.{h}.json" for h in HANDLES]
    only = sum((["--only", f] for f in files), [])
    sh("shopify", "theme", "pull", "--store", STORE, "--theme", theme, "--path", work, *only, env=env)
    changed = []
    for h in HANDLES:
        rel = f"templates/product.{h}.json"
        path = os.path.join(work, rel)
        if not os.path.exists(path):
            print("  (not on the theme)", rel); continue
        raw = open(path).read()
        body = re.sub(r"^\s*/\*.*?\*/\s*", "", raw, count=1, flags=re.S)
        data = json.loads(body)
        sec = next((s for s in data["sections"].values() if s.get("type") == "residence-gallery"), None)
        if sec is None:
            print("  no Gallery section:", rel); continue
        if sec.get("blocks"):
            print("  already has blocks:", rel); continue
        names = photos(h)[1:]
        if not names:
            print("  no photos after the main one:", rel); continue
        if len(names) > MAX_BLOCKS:
            print(f"  {h}: {len(names)} photos, block limit is {MAX_BLOCKS} - the rest stay in the viewer only"); names = names[:MAX_BLOCKS]
        blocks, order = {}, []
        for i, f in enumerate(names, 1):
            bid = f"photo_{i}"
            blocks[bid] = {"type": "photo", "settings": {"image": "shopify://shop_images/" + f}}
            order.append(bid)
        sec["blocks"], sec["block_order"] = blocks, order
        open(path, "w").write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        changed.append(rel); print(f"  {h}: {len(names)} Photo block(s)")
    if not changed:
        print("Nothing to do."); shutil.rmtree(work); return
    only = sum((["--only", f] for f in changed), [])
    args = ["shopify", "theme", "push", "--store", STORE, "--theme", theme, "--path", work, "--nodelete", "--force", *only]
    if theme == LIVE:
        args.append("--allow-live")
    sh(*args, env=env)
    shutil.rmtree(work)
    print("Photo blocks added on:", ", ".join(changed))

if __name__ == "__main__":
    main()
