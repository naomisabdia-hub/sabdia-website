#!/usr/bin/env python3
"""The home page and Contact page enquiry forms share one Interest list since
15 Sep 2026: Theme settings › Contact › Enquiry options (snippet
enquiry-form). The lists each page used to carry - the Contact body's
Enquiry option blocks and the home Contact band's Interest options - no
longer do anything, so this takes them out of the store-side templates,
where they would only mislead in the editor.

Only what the shared list already has is removed: an option, or a tailored
thank-you, that exists only in an old list stays where it is and is printed,
so it can be added to Enquiry options first and this run again.

  python3 shopify-app/share-enquiry-options.py 150783361126   # staging
  python3 shopify-app/share-enquiry-options.py 150554902630   # live (Naomi)
"""
import json, os, re, shutil, subprocess, sys, tempfile

STORE = "b91p0j-f4.myshopify.com"
LIVE = "150554902630"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTACT = "templates/page.contact.json"
HOME = "templates/index.json"
SETTINGS = "config/settings_data.json"

def token():
    for line in open(os.path.join(ROOT, ".env")):
        if line.startswith("SHOPIFY_CLI_THEME_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit("SHOPIFY_CLI_THEME_TOKEN missing from .env")

def sh(*args, **kw):
    print("$", " ".join(args))
    return subprocess.run(args, check=True, **kw)

def load(path):
    raw = open(path).read()
    return json.loads(re.sub(r"^\s*/\*.*?\*/\s*", "", raw, count=1, flags=re.S))  # Shopify's auto-generated banner

def norm(t):
    return " ".join(str(t or "").split())

def parse(text):
    """'Option | thank-you' lines -> {option lowercased: thank-you}."""
    out = {}
    for line in str(text or "").splitlines():
        name, _, thanks = line.partition("|")
        if norm(name):
            out[norm(name).lower()] = norm(thanks)
    return out

def shared_list(work):
    path = os.path.join(work, SETTINGS)
    if os.path.exists(path):
        data = load(path)
        cur = data.get("current")
        if isinstance(cur, str):
            cur = data.get("presets", {}).get(cur, {})
        if isinstance(cur, dict) and "enquiry_options" in cur:
            return parse(cur["enquiry_options"])
    schema = json.load(open(os.path.join(ROOT, "shopify-theme", SETTINGS.replace("settings_data", "settings_schema"))))
    for group in schema:
        for s in group.get("settings", []):
            if s.get("id") == "enquiry_options":
                return parse(s.get("default"))
    sys.exit("Enquiry options setting not found in settings_schema.json")

def covered(shared, name, thanks):
    key = norm(name).lower()
    return key in shared and (not norm(thanks) or shared[key] == norm(thanks))

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    theme = sys.argv[1]
    env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=token())
    work = tempfile.mkdtemp(prefix="enquiry-options-")
    sh("shopify", "theme", "pull", "--store", STORE, "--theme", theme, "--path", work,
       "--only", CONTACT, "--only", HOME, "--only", SETTINGS, env=env)
    shared = shared_list(work)
    changed = []

    path = os.path.join(work, CONTACT)
    if os.path.exists(path):
        data, touched = load(path), False
        for sec in data["sections"].values():
            if sec.get("type") != "main-contact":
                continue
            blocks = sec.get("blocks", {})
            order = sec.get("block_order", list(blocks))
            for bid in list(order):
                b = blocks.get(bid, {})
                if b.get("type") != "interest":
                    continue
                st = b.get("settings", {})
                if covered(shared, st.get("text"), st.get("thanks")):
                    del blocks[bid]
                    order.remove(bid)
                    touched = True
                    print("  Contact page: removed old option", repr(st.get("text")))
                else:
                    print("  Contact page: KEPT", repr(st.get("text")), "- not in Enquiry options (or its thank-you differs); add it there, then run again")
            sec["block_order"] = order
            if not blocks:
                sec.pop("blocks", None)
                sec.pop("block_order", None)
        if touched:
            open(path, "w").write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
            changed.append(CONTACT)

    path = os.path.join(work, HOME)
    if os.path.exists(path):
        data, touched = load(path), False
        for sec in data["sections"].values():
            st = sec.get("settings", {})
            if sec.get("type") != "contact-cta" or "interests" not in st:
                continue
            old = parse(st["interests"])
            missing = [n for n, t in old.items() if not covered(shared, n, t)]
            if missing:
                print("  Home page: KEPT Interest options - not in Enquiry options:", ", ".join(missing))
                continue
            del st["interests"]
            touched = True
            print("  Home page: removed old Interest options")
        if touched:
            open(path, "w").write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
            changed.append(HOME)

    if not changed:
        print("Nothing to do."); shutil.rmtree(work); return
    only = sum((["--only", f] for f in changed), [])
    # --force: the work folder holds only templates, and the CLI otherwise stops to ask "not a theme directory, proceed?"
    args = ["shopify", "theme", "push", "--store", STORE, "--theme", theme, "--path", work, "--nodelete", "--force", *only]
    if theme == LIVE:
        args.append("--allow-live")
    sh(*args, env=env)
    shutil.rmtree(work)
    print("Tidied:", ", ".join(changed))

if __name__ == "__main__":
    main()
