#!/usr/bin/env python3
"""Move the For Sale page template (templates/collection.json, and any other
collection.*.json) from the all-in-one Collection grid section
(main-collection) to its own sections - each with only its own settings
(14 Sep 2026, Naomi: "have the header its settings, then the Now Selling,
then each individual grid has their setting"):

  Header               sections/collection-header.liquid
  Refine toolbar       sections/collection-toolbar.liquid
  Now selling          sections/collection-intro.liquid
  The residences       sections/collection-grid.liquid   (Residence blocks hand-pick the grid)
  Sold band            sections/collection-sold.liquid
  How it works         sections/collection-how.liquid
  Private inspections  sections/collection-closing.liquid

The templates are store-side (Naomi's customizer edits live there and
shopify-theme/.shopifyignore keeps local copies from overwriting them), so this
pulls the current templates from a theme, rewrites only the ones still on
main-collection - every setting keeps its id and moves to the section that
now owns it; the Look dials go to the Header - and pushes just those files
back. Anything else on the template is left exactly as pulled. Safe to run
again: a template already moved over is skipped.

  python3 shopify-app/arrange-collection-page.py 150783361126   # staging
  python3 shopify-app/arrange-collection-page.py 150554902630   # live (Naomi)

Push the theme code (the new sections and snippets) to the same theme first,
or in the same push-live.sh run.
"""
import json, os, re, shutil, subprocess, sys, tempfile

STORE = "b91p0j-f4.myshopify.com"
LIVE = "150554902630"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SECTIONS = os.path.join(ROOT, "shopify-theme", "sections")
# Page order: (template key, section type). Which ids each takes is read
# from the section's own schema, so the two can never disagree.
NEW = [
    ("header", "collection-header"),
    ("toolbar", "collection-toolbar"),
    ("intro", "collection-intro"),
    ("grid", "collection-grid"),
    ("sold", "collection-sold"),
    ("how", "collection-how"),
    ("closing", "collection-closing"),
]

def env_value(key):
    for line in open(os.path.join(ROOT, ".env")):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""

def sh(*args, **kw):
    print("$", " ".join(args))
    return subprocess.run(args, check=True, **kw)

def schema_ids(typ):
    t = open(os.path.join(SECTIONS, typ + ".liquid")).read()
    sc = json.loads(t.split("{% schema %}", 1)[1].split("{% endschema %}", 1)[0])
    return [s["id"] for s in sc["settings"] if "id" in s]

def convert(data):
    """Rewrite one template in place. Returns True when it changed."""
    sections = data["sections"]
    old_key = next((k for k, s in sections.items() if s.get("type") == "main-collection"), None)
    if old_key is None:
        return False
    old = sections[old_key]
    settings = dict(old.get("settings", {}))
    order = data.get("order", list(sections))
    at = order.index(old_key)
    new_keys = []
    for key, typ in NEW:
        k = key
        while k in sections and k not in new_keys:
            k += "-2"
        ids = schema_ids(typ)
        sections[k] = {"type": typ, "settings": {i: settings[i] for i in ids if i in settings}}
        new_keys.append(k)
    del sections[old_key]
    order[at:at + 1] = new_keys
    data["order"] = order
    return True

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    theme = sys.argv[1]
    env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=env_value("SHOPIFY_CLI_THEME_TOKEN") or sys.exit("SHOPIFY_CLI_THEME_TOKEN missing from .env"))
    work = tempfile.mkdtemp(prefix="arrange-collection-")
    sh("shopify", "theme", "pull", "--store", STORE, "--theme", theme, "--path", work, "--only", "templates/collection*.json", env=env)
    changed = []
    tdir = os.path.join(work, "templates")
    for name in sorted(os.listdir(tdir)) if os.path.isdir(tdir) else []:
        if not (name == "collection.json" or re.match(r"collection\.[\w-]+\.json$", name)):
            continue
        rel = "templates/" + name
        path = os.path.join(tdir, name)
        raw = open(path).read()
        body = re.sub(r"^\s*/\*.*?\*/\s*", "", raw, count=1, flags=re.S)  # Shopify's auto-generated banner
        data = json.loads(body)
        if not convert(data):
            print("  already its own sections:", rel); continue
        open(path, "w").write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        changed.append(rel)
        print("  moved over:", rel, "->", data["order"])
    if not changed:
        print("Nothing to push."); shutil.rmtree(work); return
    only = sum((["--only", f] for f in changed), [])
    # --force: the work folder holds only templates, and the CLI otherwise stops to ask "not a theme directory, proceed?"
    args = ["shopify", "theme", "push", "--store", STORE, "--theme", theme, "--path", work, "--nodelete", "--force", *only]
    if theme == LIVE or "--allow-live" in sys.argv:
        args.append("--allow-live")
    sh(*args, env=env)
    shutil.rmtree(work)
    print("Moved over:", ", ".join(changed))

if __name__ == "__main__":
    main()
