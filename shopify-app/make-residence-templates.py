#!/usr/bin/env python3
"""Write each completed residence's own copy of the Collection residence
template (14 Sep 2026): page.collection-<handle>.json, assigned to that
one page, so the Photo blocks and the photo/film pickers in its Collection
residence section belong to that residence alone.

    python3 shopify-app/make-residence-templates.py <theme id> [--force] [handles...]

Starts from the store's page.collection-item.json (Naomi's dials), then:
Collection residence - Media folder = the residence's product (its
photographs and film in Products › Media), hero photo and film poster =
the main photo, film = the film in that folder, one Photo block per
photograph; Similar residences - the cards of residences with a folder
show its main photo (from Shopify, not Supabase) and link to their pages,
HAVEN and SPECTRE join the list. A template already on disk is rewritten
only with --force. First push ships them; push-live.sh then lists them in
.shopifyignore so the store copy leads.
"""
import json, os, re, shutil, subprocess, sys, tempfile, urllib.request

STORE = "b91p0j-f4.myshopify.com"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HANDLES = ("milos", "petra", "kirra", "hermosa", "encanto", "haven", "spectre", "ammos", "alhambra", "eden")
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
    d = gql("""query($h:String!){ productByHandle(handle:$h){ title media(first:250){ nodes{ mediaContentType
        ... on MediaImage{ image{ url } } ... on Video{ filename sources{ width height } } } } } }""", {"h": handle})
    p = d["productByHandle"]
    if not p:
        return None, [], []
    photos, films = [], []
    for n in p["media"]["nodes"]:
        if n["mediaContentType"] == "IMAGE" and n.get("image"):
            photos.append(n["image"]["url"].split("?")[0].rsplit("/", 1)[-1])
        elif n["mediaContentType"] == "VIDEO":
            srcs = [s for s in (n.get("sources") or []) if s.get("width")]
            w = max((s["width"] for s in srcs), default=0); h = max((s["height"] for s in srcs), default=0)
            films.append({"name": n.get("filename") or "", "landscape": w > h})
    return p["title"], photos, films


def similar_blocks(sec, heroes):
    """Similar residences: residences with a Media folder show their main
    photo from Shopify and link to their page; HAVEN and SPECTRE join."""
    blocks, order = sec.setdefault("blocks", {}), sec.setdefault("block_order", list(sec.get("blocks", {})))
    have = set()
    for bid in order:
        st = blocks[bid].setdefault("settings", {})
        page = (st.get("page") or "").strip()
        link = st.get("link") or ""
        h = page[len("collection-"):] if page.startswith("collection-") else ""
        if not h and "/pages/collection-" in link:
            h = link.split("/pages/collection-", 1)[1].split("?")[0].split("#")[0].strip("/")
        if h in heroes:
            st["page"] = f"collection-{h}"
            st["image"] = f"shopify://shop_images/{heroes[h]}"
            st.pop("product", None)
            have.add(h)
    for h in HANDLES:
        if h in have or h not in heroes:
            continue
        bid = f"residence_{h}"
        blocks[bid] = {"type": "residence", "settings": {"page": f"collection-{h}", "image": f"shopify://shop_images/{heroes[h]}"}}
        order.append(bid)


def main():
    args = [a for a in sys.argv[1:] if a != "--force"]
    force = "--force" in sys.argv
    if not args:
        sys.exit(__doc__)
    theme, want = args[0], (args[1:] or list(HANDLES))
    env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=env_val("SHOPIFY_CLI_THEME_TOKEN"))
    work = tempfile.mkdtemp(prefix="residence-templates-")
    subprocess.run(["shopify", "theme", "pull", "--store", STORE, "--theme", theme, "--path", work, "--only", "templates/page.collection-item.json"], check=True, env=env)
    raw = open(os.path.join(work, "templates/page.collection-item.json")).read()
    base = json.loads(re.sub(r"^\s*/\*.*?\*/\s*", "", raw, count=1, flags=re.S))
    shutil.rmtree(work)
    info = {h: media(h) for h in HANDLES}
    heroes = {h: v[1][0] for h, v in info.items() if v[1]}
    for h in want:
        out = os.path.join(ROOT, "shopify-theme", "templates", f"page.collection-{h}.json")
        if os.path.exists(out) and not force:
            print(f"  {h}: template exists, left alone (--force to rewrite)"); continue
        title, photos, films = info[h]
        if not photos:
            print(f"  {h}: no photos on the product yet, skipped"); continue
        hero, rest = photos[0], photos[1:]
        film = films[0] if films else None
        film_ref = f"shopify://files/videos/{film['name']}" if film and film["name"] else ""
        t = json.loads(json.dumps(base))
        for key, sec in t["sections"].items():
            st = sec.setdefault("settings", {})
            typ = sec.get("type")
            if typ == "main-collection-item":
                st.update({"media_product": h, "hero_image": f"shopify://shop_images/{hero}", "film": film_ref,
                           "film_poster": f"shopify://shop_images/{hero}", "film_2": "", "film_2_poster": "", "side_photo_1": "", "side_photo_2": ""})
                if film:
                    st["film_shape"] = "16/9" if film["landscape"] else "9/16"
                blocks, order = {}, []
                for i, f in enumerate(rest[:MAX_BLOCKS], 1):
                    blocks[f"photo_{i}"] = {"type": "photo", "settings": {"image": f"shopify://shop_images/{f}"}}
                    order.append(f"photo_{i}")
                sec["blocks"], sec["block_order"] = blocks, order
                if len(rest) > MAX_BLOCKS:
                    print(f"  {h}: {len(rest)} photos, only the first {MAX_BLOCKS} get blocks (Shopify's limit); delete the blocks and the gallery shows them all from the Media folder")
            elif typ == "collection-similar":
                similar_blocks(sec, heroes)
        open(out, "w").write(json.dumps(t, indent=2, ensure_ascii=False) + "\n")
        print(f"  {h}: {len(rest)} Photo block(s), hero {hero}, film {film_ref or 'none'} -> templates/page.collection-{h}.json")


if __name__ == "__main__":
    main()
