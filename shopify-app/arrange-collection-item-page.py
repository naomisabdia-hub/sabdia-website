#!/usr/bin/env python3
"""Arrange every Collection residence page template (the completed homes:
page.collection-item.json and page.collection-<house>.json) into the sections
Naomi asked for on 15 Sep 2026 - each with only its own settings, and every
photograph a block under its section:

  Header                    sections/collection-item-header.liquid   hero photo / film pickers, badge, specs bar
  About                     sections/collection-item-about.liquid    the story + two Photo blocks beside it
  The residence             sections/collection-item-gallery.liquid  one Photo block per photograph
  The film                  sections/collection-item-film.liquid     the film as a reel, film + poster pickers
  The Series                sections/series-strip.liquid
  Now selling               sections/collection-item-closing.liquid  the closing band + share row
  More from the Collection  sections/collection-similar.liquid       Residence blocks

The templates are store-side (Naomi's customizer edits live there and
shopify-theme/.shopifyignore keeps local copies from overwriting them), so this
pulls the current templates from a theme, rearranges them, and pushes back
only the ones that changed. Every setting and block already on a template is
kept: the old all-in-one section's photo/film pickers go to the Header and The
film, its Photo blocks to The residence, the two story photos (the picks, else
the second and third Photo blocks) become About's Photo blocks, and the
closing band's settings move from Similar residences to Now selling. Safe to
run again: a template already arranged is left alone.

  python3 shopify-app/arrange-collection-item-page.py 150783361126   # staging
  python3 shopify-app/arrange-collection-item-page.py 150554902630   # live (Naomi)
  python3 shopify-app/arrange-collection-item-page.py --local        # the repo copies only

Push the theme code first (or in the same push-live.sh run): a template
naming a section the theme lacks renders an error in its place.
"""
import json, os, re, shutil, subprocess, sys, tempfile

STORE = "b91p0j-f4.myshopify.com"
LIVE = "150554902630"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HANDLES = ("milos", "petra", "kirra", "hermosa", "encanto", "haven", "spectre", "ammos", "alhambra", "eden")
FILES = ["templates/page.collection-item.json"] + [f"templates/page.collection-{h}.json" for h in HANDLES]

LOOK = ["look_space_top", "look_space_bottom", "look_width", "look_margins", "look_heading", "look_text", "look_label",
        "look_animate", "look_rule_top", "look_rule_bottom", "look_anchor"]
HEADER_IDS = ["media_product", "hero_image", "film", "hero_media", "hero_film_fit", "hero_dim", "hero_height", "hero_focus",
              "hero_words", "show_badge", "badge", "show_meta", "completed_word", "spec_location", "spec_style", "spec_year",
              "spec_beds", "spec_baths", "spec_cars", "spec_land"] + LOOK
ABOUT_IDS = ["media_product", "show_about_label", "about_label", "show_headline", "show_features", "features_heading",
             "fallback_text", "show_links", "gallery_button", "film_button", "story_align", "show_side_photos",
             "show_side_caption", "sticky_story", "story_split", "side_layout"]
GALLERY_IDS = ["media_product", "show_gallery", "gallery_label", "gallery_heading_html", "gallery_all_label", "show_thumbs",
               "show_expand", "stage_shape", "show_mosaic"]
FILM_RENAME = {"media_product": "media_product", "film_label": "label", "film_heading_html": "heading_html", "film_text": "text",
               "sound_label": "sound_label", "show_film_caption": "show_caption", "film_side": "side", "film_shape": "shape"}
CLOSING_IDS = ["cta_label", "cta_heading_html", "cta_text", "cta1_label", "cta1_link", "cta2_label", "cta2_link",
               "close_style", "show_share", "share_label", "copy_link_label"]
# Page order, top to bottom: (template key, section type).
ORDER = [
    ("header", "collection-item-header"),
    ("about", "collection-item-about"),
    ("gallery", "collection-item-gallery"),
    ("film", "collection-item-film"),
    ("series", "series-strip"),
    ("closing", "collection-item-closing"),
    ("similar", "collection-similar"),
]


def token():
    for line in open(os.path.join(ROOT, ".env")):
        if line.startswith("SHOPIFY_CLI_THEME_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("SHOPIFY_CLI_THEME_TOKEN missing from .env")


def sh(*args, **kw):
    print("$", " ".join(args))
    return subprocess.run(args, check=True, **kw)


def first_of(sections, typ):
    return next((k for k, s in sections.items() if s.get("type") == typ), None)


def pick(settings, ids):
    return {i: settings[i] for i in ids if i in settings}


def place(sections, key, sec):
    while key in sections:
        key += "-2"
    sections[key] = sec
    return key


def convert(data):
    """Rearrange one template in place. Returns True when it changed."""
    before = json.dumps(data, sort_keys=True)
    sections = data["sections"]

    old_key = first_of(sections, "main-collection-item")
    if old_key:
        old = sections.pop(old_key)
        st = old.get("settings", {})
        blocks = old.get("blocks", {})
        border = old.get("block_order", list(blocks))
        photos = [(bid, blocks[bid]) for bid in border if blocks.get(bid, {}).get("type") == "photo"]

        header = {"type": "collection-item-header", "settings": pick(st, HEADER_IDS)}
        if "hide_specs" in st:
            header["settings"]["show_specs"] = not st["hide_specs"]

        about = {"type": "collection-item-about", "settings": pick(st, ABOUT_IDS)}
        ab, ao = {}, []
        for i, key in enumerate(("side_photo_1", "side_photo_2")):
            img = st.get(key) or ""
            if not img and len(photos) > i + 1:  # the story photos were the second and third of the gallery
                img = photos[i + 1][1].get("settings", {}).get("image") or ""
            if img:
                ab[f"photo_{i + 1}"] = {"type": "photo", "settings": {"image": img}}
                ao.append(f"photo_{i + 1}")
        if ab:
            about["blocks"], about["block_order"] = ab, ao
        if st.get("show_story") is False:
            about["disabled"] = True

        gallery = {"type": "collection-item-gallery", "settings": pick(st, GALLERY_IDS)}
        if photos:
            gallery["blocks"] = {bid: b for bid, b in photos}
            gallery["block_order"] = [bid for bid, _ in photos]

        film = {"type": "collection-item-film", "settings": {}}
        for a, b in FILM_RENAME.items():
            if a in st:
                film["settings"][b] = st[a]
        second = st.get("body_film") == "second" and st.get("film_2")
        f = st.get("film_2") if second else st.get("film")
        p = st.get("film_2_poster") if second else st.get("film_poster")
        if f:
            film["settings"]["film"] = f
        if p:
            film["settings"]["poster"] = p
        if st.get("show_film") is False or st.get("body_film") == "none":
            film["disabled"] = True

        for key, sec in (("header", header), ("about", about), ("gallery", gallery), ("film", film)):
            place(sections, key, sec)

    sim_key = first_of(sections, "collection-similar")
    if sim_key and first_of(sections, "collection-item-closing") is None:
        sst = sections[sim_key].setdefault("settings", {})
        closing = {"type": "collection-item-closing", "settings": {}}
        for i in CLOSING_IDS:
            if i in sst:
                closing["settings"][i] = sst.pop(i)
        if sst.pop("show_close", True) is False:
            closing["disabled"] = True
        sst.pop("close_last", None)
        place(sections, "closing", closing)

    if first_of(sections, "series-strip") is None:
        place(sections, "series", {"type": "series-strip", "settings": {}})

    keys = [k for _, typ in ORDER for k in [first_of(sections, typ)] if k]
    rest = [k for k in data.get("order", list(sections)) if k in sections and k not in keys]
    data["order"] = keys + rest
    return json.dumps(data, sort_keys=True) != before


def load(path):
    raw = open(path).read()
    return json.loads(re.sub(r"^\s*/\*.*?\*/\s*", "", raw, count=1, flags=re.S))  # Shopify's auto-generated banner


def save(path, data):
    open(path, "w").write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    if sys.argv[1] == "--local":
        for rel in FILES:
            path = os.path.join(ROOT, "shopify-theme", rel)
            if not os.path.exists(path):
                continue
            data = load(path)
            if convert(data):
                save(path, data); print("  arranged:", rel, "->", data["order"])
            else:
                print("  already arranged:", rel)
        return
    theme = sys.argv[1]
    env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=token())
    work = tempfile.mkdtemp(prefix="arrange-collection-item-")
    only = sum((["--only", f] for f in FILES), [])
    sh("shopify", "theme", "pull", "--store", STORE, "--theme", theme, "--path", work, *only, env=env)
    changed = []
    for rel in FILES:
        path = os.path.join(work, rel)
        if not os.path.exists(path):
            print("  (not on the theme)", rel); continue
        data = load(path)
        if not convert(data):
            print("  already arranged:", rel); continue
        save(path, data)
        changed.append(rel)
        print("  arranged:", rel, "->", data["order"])
    if not changed:
        print("Nothing to push."); shutil.rmtree(work); return
    only = sum((["--only", f] for f in changed), [])
    flags = ["--allow-live"] if "--allow-live" in sys.argv or theme == LIVE else []
    sh("shopify", "theme", "push", "--store", STORE, "--theme", theme, "--path", work, "--nodelete", "--force", *flags, *only, env=env)
    shutil.rmtree(work)
    print("Done:", ", ".join(changed))


if __name__ == "__main__":
    main()
