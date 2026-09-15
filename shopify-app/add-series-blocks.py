#!/usr/bin/env python3
"""Give every post in "The Series" its own Post block, filled in, on the six
residence page templates and on every Collection page (15 Sep 2026), so a
tile can be clicked in the theme editor and each post is stored on the site
itself: its Instagram link, photo URL, film URL, caption, date and icon.
If the synced list (custom.series_posts) is ever lost, the blocks still
draw the whole strip, newest first.

Reads shopify-app/series-posts.json (the lists `npm run series:apply`
writes), pulls the current templates from a theme (they are store-side:
Naomi's customizer edits live there), adds one "post" block per post to the
series-strip section where none exists yet and fills any empty field of an
existing block with that post's stored value, then pushes just those files
back. Nothing already filled in is changed, so hand edits survive re-runs.
Shopify allows 50 blocks per section; posts beyond that are skipped with a
note.

A Collection page with posts that still shares page.collection-item.json
(CALLE, ELYSIUM, NERO) gets its own copy of that template here, carrying
its blocks; assign-collection-templates.py then moves the page onto it
(push-live.sh runs both, in that order).

  python3 shopify-app/add-series-blocks.py 150783361126             # staging
  python3 shopify-app/add-series-blocks.py 150554902630             # live (Naomi)
  python3 shopify-app/add-series-blocks.py 150783361126 --dry-run   # report only
"""
import json, os, re, shutil, subprocess, sys, tempfile

STORE = "b91p0j-f4.myshopify.com"
LIVE = "150554902630"
MAX_BLOCKS = 50
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRODUCTS = ("qasr", "solace", "sierra", "caspian", "aether", "capri")
SHARED = "templates/page.collection-item.json"
KINDS = ("REEL", "CAROUSEL", "IMAGE")

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

def load(path):
    raw = open(path).read()
    return json.loads(re.sub(r"^\s*/\*.*?\*/\s*", "", raw, count=1, flags=re.S))

def stored(e):
    """The block settings that keep one post on the site."""
    s = {"url": e["url"], "photo_url": e.get("thumb") or "", "video_url": e.get("video") or "",
         "caption": e.get("caption") or "", "date": e.get("date") or "",
         "kind": e["type"] if e.get("type") in KINDS else "auto"}
    return {k: v for k, v in s.items() if v}

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    if not args:
        sys.exit(__doc__)
    theme = args[0]
    lists = json.load(open(os.path.join(ROOT, "shopify-app", "series-posts.json")))
    env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=token())
    work = tempfile.mkdtemp(prefix="series-blocks-")
    targets = [(h, f"templates/product.{h}.json") for h in PRODUCTS]
    targets += [(k, f"templates/page.{k}.json") for k in lists if k.startswith("collection-")]
    only = sum((["--only", f] for _, f in targets), []) + ["--only", SHARED]
    sh("shopify", "theme", "pull", "--store", STORE, "--theme", theme, "--path", work, *only, env=env)
    changed = []
    for key, rel in targets:
        path = os.path.join(work, rel)
        created = False
        if not os.path.exists(path):
            if key.startswith("collection-") and lists.get(key) and os.path.exists(os.path.join(work, SHARED)):
                shutil.copy(os.path.join(work, SHARED), path)
                created = True
            else:
                print("  (not on the theme)", rel); continue
        data = load(path)
        sec = next((s for s in data["sections"].values() if s.get("type") == "series-strip"), None)
        if sec is None:
            print("  no The Series section:", rel); continue
        blocks = sec.setdefault("blocks", {})
        order = sec.setdefault("block_order", list(blocks))
        by_url = {norm(b.get("settings", {}).get("url")): b for b in blocks.values() if b.get("type") == "post"}
        added = filled = 0
        for e in lists.get(key, []):
            if not e.get("url"):
                continue
            want = stored(e)
            b = by_url.get(norm(e["url"]))
            if b is not None:
                s = b.setdefault("settings", {})
                gaps = {k: v for k, v in want.items() if s.get(k) in (None, "") or (k == "kind" and s.get(k) == "auto")}
                if gaps:
                    s.update(gaps); filled += 1
                continue
            if len(blocks) >= MAX_BLOCKS:
                print(f"  {key}: block limit ({MAX_BLOCKS}) reached, skipping the rest"); break
            code = e["url"].rstrip("/").split("/")[-1]
            bid = f"post_{code}"
            n = 1
            while bid in blocks:
                n += 1; bid = f"post_{code}_{n}"
            blocks[bid] = {"type": "post", "settings": want}
            order.append(bid)
            by_url[norm(e["url"])] = blocks[bid]; added += 1
        if not (added or filled or created):
            print("  up to date:", rel); continue
        open(path, "w").write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        changed.append(rel)
        print(f"  {key}: {'template created from page.collection-item.json, ' if created else ''}{added} block(s) added, {filled} filled in")
    if not changed:
        print("Nothing to do."); shutil.rmtree(work); return
    if dry:
        print("Dry run, nothing pushed. Files in", work); return
    only = sum((["--only", f] for f in changed), [])
    push = ["shopify", "theme", "push", "--store", STORE, "--theme", theme, "--path", work, "--nodelete", "--force", *only]
    if theme == LIVE:
        push.append("--allow-live")
    sh(*push, env=env)
    shutil.rmtree(work)
    print("Post blocks stored on:", ", ".join(changed))

if __name__ == "__main__":
    main()
