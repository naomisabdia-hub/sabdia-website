#!/usr/bin/env python3
"""Move every residence page template from the all-in-one Property page
section (main-property) to its own sections - Header, Specs bar, Description
and enquiry, Gallery, Closing - keeping every setting and gallery block the
template already has (14 Sep 2026, Naomi: "each section should have their
edits, not one full bulk").

The product templates are store-side (Naomi's customizer edits live there and
shopify-theme/.shopifyignore keeps local copies from overwriting them), so this
pulls the current templates from a theme, rewrites only the ones still on
main-property, and pushes just those files back. Everything else in each
template - The film, the walkthrough, The Series, Related residences and
their settings - is left exactly as pulled. Safe to run again: a template
already moved over is skipped.

  python3 shopify-app/split-property-page.py 150783361126   # staging
  python3 shopify-app/split-property-page.py 150554902630   # live (Naomi)

Push the theme code (the new sections) to the same theme first, or in the
same push-live.sh run: a template naming a section the theme lacks renders
an error in its place.
"""
import json, os, re, subprocess, sys, tempfile

STORE = "b91p0j-f4.myshopify.com"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = ["templates/product.json"] + [f"templates/product.{h}.json" for h in ("qasr", "solace", "sierra", "caspian", "aether", "capri", "milos", "petra", "kirra", "hermosa", "encanto", "haven", "spectre")]

# Which of the old section's settings each new section takes (its schema ids).
HEADER_IDS = ["hero_media", "hero_image", "hero_use_links", "hero_image_ext", "hero_video", "hero_video_url", "hero_poster", "hero_dim", "hero_height", "hero_focus", "hero_words", "show_status", "show_location", "show_sold_banner", "sold_notice", "sold_banner_label", "sold_banner_link", "name_font", "name_font_file", "name_font_weight", "name_font_scale", "name_font_tracking", "name_font_caps", "look_space_top", "look_space_bottom", "look_width", "look_margins", "look_heading", "look_text", "look_label", "look_animate", "look_rule_top", "look_rule_bottom", "look_anchor"]
SPECS_IDS = ["hide_specs", "spec_show_location", "spec_show_beds", "spec_show_baths", "spec_show_cars", "spec_show_land", "spec_show_build", "spec_show_status", "specs_align", "spec_location", "spec_beds", "spec_baths", "spec_cars", "spec_land", "spec_build", "spec_status"]
STORY_IDS = ["show_about_label", "about_label", "show_headline", "show_description", "show_features", "features_heading", "sticky_desc", "body_layout", "show_enquiry", "enquiry_types", "f_first", "f_last", "f_email", "f_phone", "f_interest", "f_message", "optin_label", "privacy_note", "success_text", "show_brochure", "brochure_label", "show_general", "general_label", "general_link", "sold_cta_label", "prequal_budget_label", "prequal_budget", "prequal_timeline_label", "prequal_timeline", "prequal_flex_label", "prequal_flex", "prequal_loc_label", "prequal_loc_label_other", "prequal_locations", "show_sticky", "sticky_label"]
GALLERY_IDS = ["show_gallery", "gallery_label", "gallery_heading_html", "gallery_layout", "gallery_tiles", "stage_shape", "show_thumbs", "show_rooms", "show_expand", "gallery_all_label"]
CLOSING_IDS = ["show_cta", "cta_label", "cta_heading_html", "cta_text", "cta_button", "show_share", "share_label", "copy_link_label"]

# Old section key -> (type, ids). The Look dials (space, type, finishing) the
# old section had belong to the header, the top of the page; the other new
# sections start "as designed".
NEW = [
    ("header", "residence-header", HEADER_IDS),
    ("specs", "residence-specs", SPECS_IDS),
    ("story", "residence-story", STORY_IDS),
    ("gallery", "residence-gallery", GALLERY_IDS),
    ("closing", "residence-closing", CLOSING_IDS),
]

def token():
    for line in open(os.path.join(ROOT, ".env")):
        if line.startswith("SHOPIFY_CLI_THEME_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("SHOPIFY_CLI_THEME_TOKEN missing from .env")

def sh(*args, **kw):
    print("$", " ".join(args))
    return subprocess.run(args, check=True, **kw)

def convert(data):
    """Rewrite one template in place. Returns True when it changed."""
    sections = data["sections"]
    old_key = next((k for k, s in sections.items() if s.get("type") == "main-property"), None)
    if old_key is None:
        return False
    old = sections[old_key]
    settings = old.get("settings", {})
    order = data.get("order", list(sections))
    at = order.index(old_key)
    new_keys = []
    for key, typ, ids in NEW:
        k = key
        while k in sections and k not in new_keys:
            k += "-2"
        sec = {"type": typ, "settings": {i: settings[i] for i in ids if i in settings}}
        if typ == "residence-gallery" and old.get("blocks"):
            sec["blocks"] = old["blocks"]
            sec["block_order"] = old.get("block_order", list(old["blocks"]))
        sections[k] = sec
        new_keys.append(k)
    del sections[old_key]
    order[at:at + 1] = new_keys
    data["order"] = order
    return True

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    theme = sys.argv[1]
    env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=token())
    work = tempfile.mkdtemp(prefix="split-property-")
    only = sum((["--only", f] for f in FILES), [])
    sh("shopify", "theme", "pull", "--store", STORE, "--theme", theme, "--path", work, *only, env=env)
    changed = []
    for rel in FILES:
        path = os.path.join(work, rel)
        if not os.path.exists(path):
            print("  (not on the theme)", rel); continue
        raw = open(path).read()
        body = re.sub(r"^\s*/\*.*?\*/\s*", "", raw, count=1, flags=re.S)  # Shopify's auto-generated banner
        data = json.loads(body)
        if not convert(data):
            print("  already its own sections:", rel); continue
        open(path, "w").write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        changed.append(rel)
        print("  moved over:", rel, "->", data["order"])
    if not changed:
        print("Nothing to push."); return
    only = sum((["--only", f] for f in changed), [])
    flags = ["--allow-live"] if "--allow-live" in sys.argv or theme == "150554902630" else []
    sh("shopify", "theme", "push", "--store", STORE, "--theme", theme, "--path", work, "--nodelete", "--force", *flags, *only, env=env)
    print("Done:", ", ".join(changed))

if __name__ == "__main__":
    main()
