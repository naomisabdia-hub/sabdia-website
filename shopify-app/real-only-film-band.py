#!/usr/bin/env python3
"""Keep the home page film band ("Our homes, on film") to real photographs
only (Naomi, 14 Sep 2026: "this section must only be real video and images,
not renders"). Pulls templates/index.json from a theme, swaps every photo
block whose file is a render (qasr-render-…, caspian-render-…, or any
"-render-" name) for a real AETHER photograph from the 14 Sep listing shoot,
and pushes the template back. Optionally points the reel at a new film with
--film URL --poster URL (the real-footage cut lives on the Desktop until it
is uploaded). Run again any time; blocks already real are left alone.

  python3 shopify-app/real-only-film-band.py 150783361126            # staging
  python3 shopify-app/real-only-film-band.py 150554902630            # live (Naomi)
  python3 shopify-app/real-only-film-band.py 150554902630 --film https://…/completed-reel-v2.mp4 --poster https://…/completed-reel-v2-poster.jpg
"""
import json, os, re, shutil, subprocess, sys, tempfile

STORE = "b91p0j-f4.myshopify.com"
LIVE = "150554902630"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REAL = [  # AETHER, Hendra - photographs, in the order they are used
    ("aether-exterior-front-dusk-01.jpg", "AETHER, Hendra, the street elevation at dusk"),
    ("aether-alfresco-pool-dusk-01.jpg", "The alfresco and pool at AETHER at dusk"),
    ("aether-kitchen-dining-01.jpg", "The kitchen and dining at AETHER"),
    ("aether-staircase-01.jpg", "The staircase at AETHER"),
    ("aether-master-bedroom-01.jpg", "The master bedroom at AETHER"),
]

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
    film = poster = None
    a = sys.argv[2:]
    while a:
        k = a.pop(0)
        if k == "--film": film = a.pop(0)
        elif k == "--poster": poster = a.pop(0)
    env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=env_val("SHOPIFY_CLI_THEME_TOKEN"))
    work = tempfile.mkdtemp(prefix="film-band-")
    rel = "templates/index.json"
    sh("shopify", "theme", "pull", "--store", STORE, "--theme", theme, "--path", work, "--only", rel, env=env)
    path = os.path.join(work, rel)
    raw = open(path).read()
    data = json.loads(re.sub(r"^\s*/\*.*?\*/\s*", "", raw, count=1, flags=re.S))
    sec = next((s for s in data["sections"].values() if s.get("type") == "film-band"), None)
    if sec is None:
        print("No film band on the home page."); shutil.rmtree(work); return
    used = {b.get("settings", {}).get("image", "").rsplit("/", 1)[-1] for b in sec.get("blocks", {}).values()}
    pool = [r for r in REAL if r[0] not in used]
    changed = 0
    for bid in sec.get("block_order", []):
        b = sec["blocks"][bid]
        st = b.setdefault("settings", {})
        src = (st.get("image") or st.get("ext") or "")
        if b.get("type") == "photo" and "-render-" in src and pool:
            f, alt = pool.pop(0)
            st["image"] = "shopify://shop_images/" + f; st["ext"] = ""; st["alt"] = alt
            print(f"  {bid}: {src.rsplit('/', 1)[-1]} -> {f}"); changed += 1
    st = sec.setdefault("settings", {})
    if film:
        st["video_url"] = film; st["film"] = None; changed += 1; print("  reel ->", film)
    if poster:
        st["poster_ext"] = poster; st["poster"] = None; changed += 1
    if not changed:
        print("Nothing to change - the band is already real photographs."); shutil.rmtree(work); return
    open(path, "w").write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    args = ["shopify", "theme", "push", "--store", STORE, "--theme", theme, "--path", work, "--nodelete", "--force", "--only", rel]
    if theme == LIVE:
        args.append("--allow-live")
    sh(*args, env=env)
    shutil.rmtree(work)
    print("Film band updated.")

if __name__ == "__main__":
    main()
