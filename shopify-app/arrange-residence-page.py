#!/usr/bin/env python3
"""Arrange every residence page template into the sections Naomi asked for
on 14 Sep 2026 - each with only its own settings:

  Header                  sections/residence-header.liquid   photo or film, name, status, suburb
  Property page           sections/residence-specs.liquid    specs bar, sold banner, sticky Enquire bar
  About and enquiry       sections/residence-story.liquid    description + the enquiry flow
  The residence           sections/residence-gallery.liquid  photo / video blocks
  Private appointments    sections/residence-closing.liquid  the closing band
  The film                sections/residence-film.liquid
  The Series              sections/series-strip.liquid
  More Sabdia residences  sections/related-properties.liquid Residence blocks or the automatic row, share row
  Scroll walkthrough      sections/scroll-walk.liquid        hidden (eye off) unless the residence has one

The product templates are store-side (Naomi's customizer edits live there and
shopify-theme/.shopifyignore keeps local copies from overwriting them), so this
pulls the current templates from a theme, rearranges them, and pushes back only
the ones that changed. Every setting and block already on a template is kept:
the sold banner settings move from the Header to the Property page section,
the sticky bar settings from About and enquiry to the Property page section,
and the closing band's old share row settings (the row lives under More Sabdia
residences) are dropped. Missing sections are added with their defaults.
Safe to run again: a template already arranged is left alone.

The walkthrough is hidden (disabled) on a template whose residence has no
scroll walkthrough (Products › the residence › Scroll walkthrough folder +
Show the scroll walkthrough), read through the Admin API; where the API is not
reachable the eye is left as it is. Hidden is only the editor's eye - one click
shows it again.

  python3 shopify-app/arrange-residence-page.py 150783361126   # staging
  python3 shopify-app/arrange-residence-page.py 150554902630   # live (Naomi)

Push the theme code first (or in the same push-live.sh run): the renamed
sections and the Property page section's new settings must be on the theme.
Templates still on the old all-in-one Property page section are moved over
first with the same rules as split-property-page.py.
"""
import importlib.util, json, os, re, shutil, subprocess, sys, tempfile, urllib.request

STORE = "b91p0j-f4.myshopify.com"
LIVE = "150554902630"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HANDLES = ("qasr", "solace", "sierra", "caspian", "aether", "capri", "milos", "petra", "kirra", "hermosa", "encanto", "haven", "spectre")
FILES = ["templates/product.json"] + [f"templates/product.{h}.json" for h in HANDLES]

# Page order, top to bottom: (template key, section type).
ORDER = [
    ("header", "residence-header"),
    ("specs", "residence-specs"),
    ("story", "residence-story"),
    ("gallery", "residence-gallery"),
    ("closing", "residence-closing"),
    ("film", "residence-film"),
    ("series", "series-strip"),
    ("related", "related-properties"),
    ("walkthrough", "scroll-walk"),
]
SOLD_IDS = ["show_sold_banner", "sold_notice", "sold_banner_label", "sold_banner_link"]
STICKY_IDS = ["show_sticky", "sticky_label"]
OLD_SHARE_IDS = ["show_share", "share_label", "copy_link_label"]

def env_value(key):
    for line in open(os.path.join(ROOT, ".env")):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""

def sh(*args, **kw):
    print("$", " ".join(args))
    return subprocess.run(args, check=True, **kw)

def split_convert():
    """The old all-in-one section's move-over, borrowed from split-property-page.py."""
    spec = importlib.util.spec_from_file_location("split_property_page", os.path.join(ROOT, "shopify-app", "split-property-page.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.convert

def walkthrough_handles():
    """Handles of the residences that have a scroll walkthrough, or None when the Admin API is not reachable."""
    token = env_value("SHOPIFY_ADMIN_TOKEN")
    if not token:
        return None
    q = '{ products(first: 50) { nodes { handle f: metafield(namespace: "custom", key: "scrollwalk_folder") { value } s: metafield(namespace: "custom", key: "show_walkthrough") { value } } } }'
    req = urllib.request.Request(f"https://{STORE}/admin/api/2025-07/graphql.json", data=json.dumps({"query": q}).encode(),
                                 headers={"X-Shopify-Access-Token": token, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            nodes = json.load(r)["data"]["products"]["nodes"]
    except Exception as e:  # noqa: BLE001 - any failure just leaves the eye alone
        print("  (walkthrough check skipped - Admin API not reachable:", e, ")")
        return None
    has = set()
    for n in nodes:
        folder = ((n.get("f") or {}).get("value") or "").strip()
        show = (n.get("s") or {}).get("value")
        if folder and show not in ("false", False, "0"):
            has.add(n["handle"])
    return has

def first_of(sections, typ):
    return next((k for k, s in sections.items() if s.get("type") == typ), None)

def move(src, dst, ids):
    for i in ids:
        if i in src.get("settings", {}):
            dst.setdefault("settings", {})[i] = src["settings"].pop(i)

def arrange(data, handle, has_walk):
    """Rearrange one template in place. Returns True when it changed."""
    before = json.dumps(data, sort_keys=True)
    sections = data["sections"]
    if first_of(sections, "main-property"):
        split_convert()(data)
    keys = {}
    for key, typ in ORDER:
        k = first_of(sections, typ)
        if k is None:
            k = key
            while k in sections:
                k += "-2"
            sections[k] = {"type": typ, "settings": {}}
        keys[typ] = k
    header, specs, story, closing = (sections[keys[t]] for t in ("residence-header", "residence-specs", "residence-story", "residence-closing"))
    move(header, specs, SOLD_IDS)
    move(story, specs, STICKY_IDS)
    for i in OLD_SHARE_IDS:
        closing.get("settings", {}).pop(i, None)
    ordered = [keys[t] for _, t in ORDER]
    extras = [k for k in data.get("order", list(sections)) if k in sections and k not in ordered]  # anything Naomi added stays, after the film
    if extras:
        at = ordered.index(keys["residence-film"]) + 1
        ordered[at:at] = extras
    data["order"] = ordered
    walk = sections[keys["scroll-walk"]]
    if has_walk is not None:
        if handle in has_walk:
            walk.pop("disabled", None)
        else:
            walk["disabled"] = True
    return json.dumps(data, sort_keys=True) != before

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    theme = sys.argv[1]
    env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=env_value("SHOPIFY_CLI_THEME_TOKEN") or sys.exit("SHOPIFY_CLI_THEME_TOKEN missing from .env"))
    has_walk = walkthrough_handles()
    if has_walk is not None:
        print("  residences with a walkthrough:", ", ".join(sorted(has_walk)) or "none")
    work = tempfile.mkdtemp(prefix="arrange-residence-")
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
        m = re.match(r"templates/product\.(\w+)\.json", rel)
        handle = m.group(1) if m else ""  # product.json, the default, has no residence of its own
        if not arrange(data, handle, has_walk):
            print("  already arranged:", rel); continue
        open(path, "w").write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        changed.append(rel)
        print("  arranged:", rel, "->", data["order"], "(walkthrough hidden)" if data["sections"][next(k for k, s in data["sections"].items() if s["type"] == "scroll-walk")].get("disabled") else "")
    if not changed:
        print("Nothing to push."); shutil.rmtree(work); return
    only = sum((["--only", f] for f in changed), [])
    # --force: the work folder holds only templates, and the CLI otherwise stops to ask "not a theme directory, proceed?"
    args = ["shopify", "theme", "push", "--store", STORE, "--theme", theme, "--path", work, "--nodelete", "--force", *only]
    if theme == LIVE or "--allow-live" in sys.argv:
        args.append("--allow-live")
    sh(*args, env=env)
    shutil.rmtree(work)
    print("Arranged:", ", ".join(changed))

if __name__ == "__main__":
    main()
