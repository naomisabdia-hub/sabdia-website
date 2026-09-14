#!/usr/bin/env python3
"""Write the page template for each completed residence that moved into
Products (14 Sep 2026), in AETHER's shape: the same nine sections with
AETHER's dials, this residence's own media in the pickers, one Photo block
per photograph in The residence, the film in the Header (landscape films
only) and in The film section. As a completed home (Status Completed) it
carries no enquiry form, no sticky Enquire bar and no Private appointments
band; the Collection page is where it is listed.

    python3 shopify-app/make-residence-templates.py <theme id> [handles...]

Reads AETHER's template from the theme (Naomi's tuned copy), the media
from Products › the residence › Media, and writes
shopify-theme/templates/product.<handle>.json. A template that already
exists locally is overwritten only with --force. First push ships them;
push-live.sh then lists them in .shopifyignore so the store copy leads.
"""
import json, os, re, shutil, subprocess, sys, tempfile, urllib.request

STORE = "b91p0j-f4.myshopify.com"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HANDLES = ("milos", "petra", "kirra", "hermosa", "encanto", "haven", "spectre")
MAX_BLOCKS = 50


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


def media(handle):
    d = gql("""query($h:String!){ productByHandle(handle:$h){ title media(first:250){ nodes{ mediaContentType alt
        ... on MediaImage{ image{ url } } ... on Video{ filename sources{ url width height format } } } } } }""", {"h": handle})
    p = d["productByHandle"]
    if not p:
        sys.exit(f"no product {handle}")
    photos, films = [], []
    for n in p["media"]["nodes"]:
        if n["mediaContentType"] == "IMAGE" and n.get("image"):
            photos.append(n["image"]["url"].split("?")[0].rsplit("/", 1)[-1])
        elif n["mediaContentType"] == "VIDEO":
            srcs = [s for s in (n.get("sources") or []) if s.get("width")]
            w = max((s["width"] for s in srcs), default=0); h = max((s["height"] for s in srcs), default=0)
            films.append({"name": n.get("filename") or "", "landscape": w > h})
    return p["title"], photos, films


def main():
    args = [a for a in sys.argv[1:] if a != "--force"]
    force = "--force" in sys.argv
    if not args:
        sys.exit(__doc__)
    theme, want = args[0], (args[1:] or list(HANDLES))
    env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=env_val("SHOPIFY_CLI_THEME_TOKEN"))
    work = tempfile.mkdtemp(prefix="residence-templates-")
    subprocess.run(["shopify", "theme", "pull", "--store", STORE, "--theme", theme, "--path", work, "--only", "templates/product.aether.json"], check=True, env=env)
    raw = open(os.path.join(work, "templates/product.aether.json")).read()
    base = json.loads(re.sub(r"^\s*/\*.*?\*/\s*", "", raw, count=1, flags=re.S))
    shutil.rmtree(work)
    for h in want:
        out = os.path.join(ROOT, "shopify-theme", "templates", f"product.{h}.json")
        if os.path.exists(out) and not force:
            print(f"  {h}: template exists, left alone (--force to rewrite)"); continue
        title, photos, films = media(h)
        if not photos:
            print(f"  {h}: no photos on the product yet, skipped"); continue
        hero, rest = photos[0], photos[1:]
        film = films[0] if films else None
        film_ref = f"shopify://files/videos/{film['name']}" if film and film["name"] else ""
        t = json.loads(json.dumps(base))
        for key, sec in t["sections"].items():
            st = sec.setdefault("settings", {})
            typ = sec.get("type")
            if typ == "residence-header":
                st.update({"hero_media": "video" if (film and film["landscape"]) else "residence",
                           "hero_image": f"shopify://shop_images/{hero}", "hero_image_ext": "",
                           "hero_video": film_ref if (film and film["landscape"]) else "", "hero_video_url": "",
                           "hero_poster": f"shopify://shop_images/{hero}"})
            elif typ == "residence-specs":
                # A completed home: the status reads Completed, no sold banner, no sticky Enquire bar.
                st.update({"show_sold_banner": False, "show_sticky": False})
            elif typ == "residence-story":
                st.update({"show_enquiry": False})
            elif typ == "residence-closing":
                sec["disabled"] = True
            elif typ == "residence-gallery":
                blocks, order = {}, []
                for i, f in enumerate(rest[:MAX_BLOCKS], 1):
                    blocks[f"photo_{i}"] = {"type": "photo", "settings": {"image": f"shopify://shop_images/{f}"}}
                    order.append(f"photo_{i}")
                # A second, portrait film (a reel) joins the gallery as a Video block.
                for j, extra in enumerate(films[1:], 2):
                    if extra["name"] and len(order) < MAX_BLOCKS:
                        blocks[f"video_{j}"] = {"type": "video", "settings": {"video": f"shopify://files/videos/{extra['name']}", "poster": f"shopify://shop_images/{hero}"}}
                        order.append(f"video_{j}")
                sec["blocks"], sec["block_order"] = blocks, order
                if len(rest) > MAX_BLOCKS:
                    print(f"  {h}: {len(rest)} photos, only the first {MAX_BLOCKS} get blocks (Shopify's limit); the rest stay in the viewer")
            elif typ == "residence-film":
                st.update({"film": film_ref, "film_url": "", "poster": f"shopify://shop_images/{hero}", "poster_url": "",
                           "shape": "16/9" if (film and film["landscape"]) else "9/16"})
            elif typ == "series-strip":
                sec["blocks"], sec["block_order"] = {}, []
            elif typ == "scroll-walk":
                sec["disabled"] = True
        open(out, "w").write(json.dumps(t, indent=2, ensure_ascii=False) + "\n")
        print(f"  {h}: {len(rest)} Photo block(s), hero {hero}, film {film_ref or 'none'} -> templates/product.{h}.json")


if __name__ == "__main__":
    main()
