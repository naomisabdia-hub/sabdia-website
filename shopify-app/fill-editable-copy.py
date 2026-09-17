#!/usr/bin/env python3
"""Every word on the site is editable in Customize (Naomi, 17 Sep 2026:
"everything on this website if it has written words needs a section where I
can edit it ... so Tamsin can edit copy").

Some words on a residence page are saved on the page itself (Content ›
Pages › the residence: the headline, the description, the key features, the
form heading, intro and button; on a Collection page the headline, the story
and the key features). Their sections now have boxes for them too.
A box's words win, and an empty box shows the page's words. This fills
each empty box ONCE with the words the page shows today, so Tamsin sees
them in the panel and edits them there. Nothing on the page changes.

Dry run by default: prints what it would fill and pushes nothing.
--write pushes the filled templates and records them.

Runs once per template: a template listed in shopify-app/applied/
fill-editable-copy-<theme>.txt is left alone, so what she types (or
clears) stays as she left it on every later push. Even on a first run, a box
that already holds words is never touched.

  python3 shopify-app/fill-editable-copy.py 150783361126            # staging, dry run
  python3 shopify-app/fill-editable-copy.py 150783361126 --write    # staging
  python3 shopify-app/fill-editable-copy.py 150554902630 --write    # live
"""
import json, os, re, shutil, subprocess, sys, tempfile, urllib.request

STORE = "b91p0j-f4.myshopify.com"
LIVE = "150554902630"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APPLIED = os.path.join(ROOT, "shopify-app", "applied")

def env():
    out = {}
    for line in open(os.path.join(ROOT, ".env")):
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.rstrip("\n").split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    return out

ENV = env()

def gql(q, v=None):
    r = urllib.request.Request(
        f"https://{ENV['SHOPIFY_STORE']}/admin/api/2025-07/graphql.json",
        data=json.dumps({"query": q, "variables": v or {}}).encode(),
        headers={"X-Shopify-Access-Token": ENV["SHOPIFY_ADMIN_TOKEN"], "Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(r))
    if d.get("errors"):
        sys.exit(d["errors"])
    return d["data"]

def sh(*args, **kw):
    print("$", " ".join(args))
    return subprocess.run(args, check=True, **kw)

def load(path):
    raw = open(path).read()
    return json.loads(re.sub(r"^\s*/\*.*?\*/\s*", "", raw, count=1, flags=re.S))  # Shopify's auto-generated banner

def listed(value):
    try:
        items = json.loads(value)
    except (TypeError, ValueError):
        return ""
    return "\n".join(str(i).strip() for i in items if str(i).strip())

def text(value):
    return (value or "").strip()

# section type -> {setting id: how to read the page's words}
FILL = {
    "residence-story": {
        "headline_text": lambda p: text(p["mf"].get("headline")),
        "description_text": lambda p: text(p["body"]),
        "features_list": lambda p: listed(p["mf"].get("features")),
        "enquiry_heading": lambda p: text(p["mf"].get("enquiry_heading")),
        "enquiry_intro": lambda p: text(p["mf"].get("enquiry_text")),
        "enquiry_button": lambda p: text(p["mf"].get("enquiry_button")),
    },
    "collection-item-about": {
        "headline_html": lambda p: text(p["mf"].get("headline")),
        "story_text": lambda p: text(p["mf"].get("story")),
        "features_text": lambda p: listed(p["mf"].get("features")),
    },
}

def pages():
    out, after = {}, None
    while True:
        d = gql("""query($after: String){ pages(first: 100, after: $after){
            pageInfo{ hasNextPage endCursor }
            nodes{ handle templateSuffix body metafields(first: 100, namespace: "custom"){ nodes{ key value } } } } }""",
                {"after": after})["pages"]
        for n in d["nodes"]:
            suffix = n["templateSuffix"]
            if not suffix:
                continue
            out.setdefault(f"templates/page.{suffix}.json", []).append({
                "handle": n["handle"], "body": n["body"],
                "mf": {m["key"]: m["value"] for m in n["metafields"]["nodes"]}})
        if not d["pageInfo"]["hasNextPage"]:
            return out
        after = d["pageInfo"]["endCursor"]

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__)
    theme, write = args[0], "--write" in sys.argv
    ledger = os.path.join(APPLIED, f"fill-editable-copy-{theme}.txt")
    done = set(open(ledger).read().split()) if os.path.exists(ledger) else set()
    by_template = pages()
    # A template serving more than one page has no single set of words to copy.
    todo = sorted(t for t, ps in by_template.items() if len(ps) == 1 and t not in done)
    if not todo:
        print("Nothing to do: every page template has had its boxes filled once."); return
    work = tempfile.mkdtemp(prefix="editable-copy-")
    run_env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=ENV["SHOPIFY_CLI_THEME_TOKEN"])
    sh("shopify", "theme", "pull", "--store", STORE, "--theme", theme, "--path", work,
       *sum((["--only", t] for t in todo), []), env=run_env)
    changed, visited = [], []
    for t in todo:
        path = os.path.join(work, t)
        if not os.path.exists(path):
            continue
        page = by_template[t][0]
        data, touched, relevant = load(path), False, False
        for sec in data.get("sections", {}).values():
            fill = FILL.get(sec.get("type"))
            if not fill:
                continue
            relevant = True
            st = sec.setdefault("settings", {})
            for key, read in fill.items():
                if str(st.get(key) or "").strip():
                    continue  # already holds words: hers
                value = read(page)
                if value:
                    st[key] = value
                    touched = True
                    print(f"  {t} › {sec['type']} › {key}: {value[:70]!r}")
        if relevant:
            visited.append(t)
        if touched:
            open(path, "w").write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
            changed.append(t)
    if not write:
        print(f"Dry run: {len(changed)} template(s) would be filled; nothing pushed. Add --write to push.")
        print("Filled copies for inspection:", work)
        return
    if changed:
        only = sum((["--only", f] for f in changed), [])
        # --force: the work folder holds only templates, and the CLI otherwise stops to ask "not a theme directory, proceed?"
        push = ["shopify", "theme", "push", "--store", STORE, "--theme", theme, "--path", work, "--nodelete", "--force", *only]
        if theme == LIVE:
            push.append("--allow-live")
        sh(*push, env=run_env)
    os.makedirs(APPLIED, exist_ok=True)
    with open(ledger, "a") as f:
        for t in visited:
            f.write(t + "\n")
    shutil.rmtree(work)
    print(f"Filled {len(changed)} template(s); {len(visited)} recorded as done.")

if __name__ == "__main__":
    main()
