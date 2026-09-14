#!/usr/bin/env python3
"""Give every post in "The Series" its own Post block on the six residence
page templates, so a tile can be clicked in the theme editor and its link
(or photo, film, caption, date) changed by hand.

Reads shopify-app/series-posts.json (the lists `npm run series:apply`
writes), pulls the current product templates from a theme (they are
store-side: Naomi's customizer edits live there), adds one "post" block per
synced post to the series-strip section where none exists yet, and pushes
just those files back. Existing blocks and their settings are left alone,
so links already edited by hand survive re-runs. Shopify allows 50 blocks
per section; posts beyond that are skipped with a note.

  python3 shopify-app/add-series-blocks.py 150783361126   # staging
  python3 shopify-app/add-series-blocks.py 150554902630   # live (Naomi)
"""
import json, os, re, shutil, subprocess, sys, tempfile

STORE = "b91p0j-f4.myshopify.com"
LIVE = "150554902630"
MAX_BLOCKS = 50
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HANDLES = ("qasr", "solace", "sierra", "caspian", "aether", "capri", "milos", "petra", "kirra", "hermosa", "encanto", "haven", "spectre")

def token():
    for line in open(os.path.join(ROOT, ".env")):
        if line.startswith("SHOPIFY_CLI_THEME_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("SHOPIFY_CLI_THEME_TOKEN missing from .env")

def sh(*args, **kw):
    print("$", " ".join(args))
    return subprocess.run(args, check=True, **kw)

def norm(u):
    return re.sub(r"^https?://(www\.)?", "", (u or "").strip()).rstrip("/").lower()

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    theme = sys.argv[1]
    lists = json.load(open(os.path.join(ROOT, "shopify-app", "series-posts.json")))
    env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=token())
    work = tempfile.mkdtemp(prefix="series-blocks-")
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
        sec = next((s for s in data["sections"].values() if s.get("type") == "series-strip"), None)
        if sec is None:
            print("  no The Series section:", rel); continue
        blocks = sec.setdefault("blocks", {})
        order = sec.setdefault("block_order", list(blocks))
        have = {norm(b.get("settings", {}).get("url")) for b in blocks.values() if b.get("type") == "post"}
        added = 0
        for e in lists.get(h, []):
            url = e.get("url")
            if not url or norm(url) in have:
                continue
            if len(blocks) >= MAX_BLOCKS:
                print(f"  {h}: block limit ({MAX_BLOCKS}) reached, skipping the rest"); break
            code = url.rstrip("/").split("/")[-1]
            bid = f"post_{code}"
            n = 1
            while bid in blocks:
                n += 1; bid = f"post_{code}_{n}"
            blocks[bid] = {"type": "post", "settings": {"url": url}}
            order.append(bid)
            have.add(norm(url)); added += 1
        if not added:
            print("  up to date:", rel); continue
        open(path, "w").write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        changed.append(rel); print(f"  {h}: {added} block(s) added")
    if not changed:
        print("Nothing to do."); shutil.rmtree(work); return
    only = sum((["--only", f] for f in changed), [])
    args = ["shopify", "theme", "push", "--store", STORE, "--theme", theme, "--path", work, "--nodelete", "--force", *only]
    if theme == LIVE:
        args.append("--allow-live")
    sh(*args, env=env)
    shutil.rmtree(work)
    print("Post blocks added on:", ", ".join(changed))

if __name__ == "__main__":
    main()
