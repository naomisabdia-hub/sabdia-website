#!/usr/bin/env python3
"""The Process page takes the About page's closing band (Naomi, 15 Sep 2026:
"this section on the about page needs to be moved to process and remove the
process section from process - also the architecture and design etc section
needs a title").

  - About (templates/page.about.json): the Now selling band ("See what is
    for sale now.", a Call to action section) comes off the page.
  - Process (templates/page.services.json): The Process steps section
    (Design, Develop, Construct, Deliver) comes off, the Now selling band
    takes its place with every word, link and dial it had on About, and the
    stages section (Architecture & Design and the rest) gets a small label
    and a heading above it, only while both are still empty.

Settings travel as they are, nothing else on either page changes, and the
heading can be rewritten in Customize like any other. Run again any time; it
only writes what differs.

  python3 shopify-app/move-now-selling-to-process.py 150783361126     # staging
  python3 shopify-app/move-now-selling-to-process.py 150554902630     # live (Naomi)
"""
import copy, json, os, re, shutil, subprocess, sys, tempfile

STORE = "b91p0j-f4.myshopify.com"
LIVE = "150554902630"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ABOUT = "templates/page.about.json"
PROCESS = "templates/page.services.json"
MOVED_KEY = "now_selling"
STAGES_LABEL = "What We Do"
STAGES_HEADING = "Drawn, built and <em>finished</em> by one studio."

def env_val(key):
    for line in open(os.path.join(ROOT, ".env")):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(f"{key} missing from .env")

def sh(*args, **kw):
    print("$", " ".join(args))
    return subprocess.run(args, check=True, **kw)

def load(path):
    raw = open(path).read()
    return json.loads(re.sub(r"^\s*/\*.*?\*/\s*", "", raw, count=1, flags=re.S))

def is_now_selling(sec):
    return sec.get("type") == "cta-centered" and "sale" in json.dumps(sec.get("settings", {})).lower()

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    theme = sys.argv[1]
    env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=env_val("SHOPIFY_CLI_THEME_TOKEN"))
    work = tempfile.mkdtemp(prefix="now-selling-")
    sh("shopify", "theme", "pull", "--store", STORE, "--theme", theme, "--path", work, "--only", ABOUT, "--only", PROCESS, env=env)
    about, process = load(os.path.join(work, ABOUT)), load(os.path.join(work, PROCESS))
    changed = set()

    # 1. Take the Now selling band off About (kept whole for the Process page).
    band = None
    for key in list(about.get("order", [])):
        sec = about["sections"][key]
        if is_now_selling(sec):
            band = copy.deepcopy(sec)
            del about["sections"][key]
            about["order"].remove(key)
            changed.add(ABOUT)
            print(f"  About: took off '{key}' ({sec['settings'].get('label', '')})")
            break

    # 2. Take The Process steps off the Process page, remembering where they sat.
    slot = None
    for key in list(process.get("order", [])):
        if process["sections"][key].get("type") == "process-steps":
            slot = process["order"].index(key)
            del process["sections"][key]
            process["order"].remove(key)
            changed.add(PROCESS)
            print(f"  Process: took off '{key}' (The Process steps)")

    # 3. The band lands where the steps were (or at the end), unless it is already there.
    if MOVED_KEY in process["sections"]:
        print("  Process: the Now selling band is already on the page")
    elif band is not None:
        band.pop("disabled", None)
        process["sections"][MOVED_KEY] = band
        at = slot if slot is not None else len(process["order"])
        process["order"].insert(at, MOVED_KEY)
        changed.add(PROCESS)
        print(f"  Process: Now selling band placed at position {at + 1}")
    else:
        print("  About has no Now selling band to move; nothing placed on Process")

    # 4. A label and heading above the stages, only while both are empty.
    for key in process.get("order", []):
        sec = process["sections"][key]
        if sec.get("type") != "services-detail":
            continue
        st = sec.setdefault("settings", {})
        if not st.get("label") and not st.get("heading_html"):
            st["label"], st["heading_html"] = STAGES_LABEL, STAGES_HEADING
            changed.add(PROCESS)
            print(f"  Process: '{key}' titled: {STAGES_LABEL} / {STAGES_HEADING}")
        else:
            print(f"  Process: '{key}' already has a title, left as it is")

    if not changed:
        print("Nothing to do: the Process page already has the band and the title."); shutil.rmtree(work); return
    for rel, data in ((ABOUT, about), (PROCESS, process)):
        open(os.path.join(work, rel), "w").write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    # Process first in the list so the band is never on neither page.
    args = ["shopify", "theme", "push", "--store", STORE, "--theme", theme, "--path", work, "--nodelete", "--force"]
    for rel in (PROCESS, ABOUT):
        if rel in changed:
            args += ["--only", rel]
    if theme == LIVE:
        args.append("--allow-live")
    sh(*args, env=env)
    shutil.rmtree(work)

if __name__ == "__main__":
    main()
