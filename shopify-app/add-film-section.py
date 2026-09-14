#!/usr/bin/env python3
"""Put "The film" section (sections/residence-film.liquid) on every residence
page template, straight after the Property page section.

The product templates are store-side (Naomi's customizer edits live there and
shopify-theme/.shopifyignore keeps local copies from overwriting them), so this
pulls the current templates from a theme, inserts the section only where it is
missing, and pushes just those files back. Everything else in the template is
left exactly as pulled.

  python3 shopify-app/add-film-section.py 150783361126   # staging
  python3 shopify-app/add-film-section.py 150554902630   # live (Naomi)

Add --from-live to base the templates on the LIVE theme's copies (Naomi's
latest edits) while pushing to another theme, e.g. bringing staging up to date.
"""
import json, os, re, shutil, subprocess, sys, tempfile

STORE = "b91p0j-f4.myshopify.com"
LIVE = "150554902630"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = ["templates/product.json"] + [f"templates/product.{h}.json" for h in ("qasr", "solace", "sierra", "caspian", "aether", "capri")]

def token():
    for line in open(os.path.join(ROOT, ".env")):
        if line.startswith("SHOPIFY_CLI_THEME_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("SHOPIFY_CLI_THEME_TOKEN missing from .env")

def sh(*args, **kw):
    print("$", " ".join(args))
    return subprocess.run(args, check=True, **kw)

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    theme = sys.argv[1]
    source = LIVE if "--from-live" in sys.argv else theme
    env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=token())
    work = tempfile.mkdtemp(prefix="film-section-")
    only = sum((["--only", f] for f in FILES), [])
    sh("shopify", "theme", "pull", "--store", STORE, "--theme", source, "--path", work, *only, env=env)
    changed = []
    for rel in FILES:
        path = os.path.join(work, rel)
        if not os.path.exists(path):
            print("  (not on the theme)", rel); continue
        raw = open(path).read()
        body = re.sub(r"^\s*/\*.*?\*/\s*", "", raw, count=1, flags=re.S)  # Shopify's auto-generated banner
        data = json.loads(body)
        if any(s.get("type") == "residence-film" for s in data["sections"].values()):
            print("  already has The film:", rel); continue
        data["sections"]["film"] = {"type": "residence-film", "settings": {}}
        order = data.get("order", list(data["sections"]))
        anchor = next((k for k in order if data["sections"][k]["type"] == "main-property"), order[0])
        order.insert(order.index(anchor) + 1, "film")
        data["order"] = order
        open(path, "w").write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
        changed.append(rel)
    if not changed:
        print("Nothing to do."); shutil.rmtree(work); return
    only = sum((["--only", f] for f in changed), [])
    # --force: the work folder holds only templates, and the CLI otherwise stops to ask "not a theme directory, proceed?"
    args = ["shopify", "theme", "push", "--store", STORE, "--theme", theme, "--path", work, "--nodelete", "--force", *only]
    if theme == LIVE:
        args.append("--allow-live")
    sh(*args, env=env)
    shutil.rmtree(work)
    print("Added The film to:", ", ".join(changed))

if __name__ == "__main__":
    main()
