#!/usr/bin/env python3
"""Alternate the home page section backgrounds (Naomi, 15 Sep 2026): after
the header, the Featured residence on the warm grey, About Sabdia on white,
the residences for sale on the warm grey, How we work on white, the
residence film on its own dark colour, the client testimonials on the warm
grey and the Contact form on white.

Sets only Look > Background on those seven sections (Stone = the warm grey
#E5E2DF, Cream = the page white #F4F4F4 under the brand kit), matched by
section type, so every other setting and block stays exactly as it is and
the choice shows in Customize, where it can be changed like any other dial.
Run again any time; it only writes when something differs.

  python3 shopify-app/home-alternate-backgrounds.py 150783361126     # staging
  python3 shopify-app/home-alternate-backgrounds.py 150554902630     # live (Naomi)
"""
import json, os, re, shutil, subprocess, sys, tempfile

STORE = "b91p0j-f4.myshopify.com"
LIVE = "150554902630"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SURFACES = {  # section type -> Look > Background
    "featured-residence": "stone",   # Featured residence: warm grey
    "home-about": "cream",           # About Sabdia: white
    "properties-grid": "stone",      # Current residences for sale: warm grey
    "process-steps": "cream",        # How we work: white
    "film-band": "design",           # The residence film: its own dark colour
    "testimonial": "stone",          # Client testimonials: warm grey
    "contact-cta": "cream",          # Contact form: white
}

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
    env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=env_val("SHOPIFY_CLI_THEME_TOKEN"))
    work = tempfile.mkdtemp(prefix="home-backgrounds-")
    rel = "templates/index.json"
    sh("shopify", "theme", "pull", "--store", STORE, "--theme", theme, "--path", work, "--only", rel, env=env)
    path = os.path.join(work, rel)
    raw = open(path).read()
    data = json.loads(re.sub(r"^\s*/\*.*?\*/\s*", "", raw, count=1, flags=re.S))
    changed = False
    for key in data.get("order", []):
        sec = data["sections"].get(key, {})
        want = SURFACES.get(sec.get("type"))
        if want is None or sec.get("disabled"):
            continue
        st = sec.setdefault("settings", {})
        now = st.get("look_surface", "design")
        print(f"  {key:12s} {sec['type']:20s} {now} -> {want}")
        if now != want:
            st["look_surface"] = want
            changed = True
    if not changed:
        print("The home page backgrounds already alternate."); shutil.rmtree(work); return
    open(path, "w").write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    args = ["shopify", "theme", "push", "--store", STORE, "--theme", theme, "--path", work, "--nodelete", "--force", "--only", rel]
    if theme == LIVE:
        args.append("--allow-live")
    sh(*args, env=env)
    shutil.rmtree(work)

if __name__ == "__main__":
    main()
