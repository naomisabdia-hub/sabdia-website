#!/usr/bin/env python3
"""Plain-English copy pass for the Shopify store.

Replaces the AI-sounding sentences listed in copy-rewrites.json with the
short human ones, everywhere they live on the store side:

  python3 shopify-app/humanise-copy.py dry       # show what would change
  python3 shopify-app/humanise-copy.py staging   # customizer templates on the staging theme
  python3 shopify-app/humanise-copy.py live      # customizer templates on the LIVE theme
  python3 shopify-app/humanise-copy.py products  # CAPRI / AETHER sold notices + em dashes out of
                                                  # product/page text (not Instagram captions or legal pages)

Every mode also swaps em dashes for plain hyphens in whatever it touches.

Theme code (section defaults) carries the same rewrites and lands with the
normal theme push. Needs SHOPIFY_STORE, SHOPIFY_CLI_THEME_TOKEN and
SHOPIFY_ADMIN_TOKEN in .env. Instagram captions and legal pages are never touched.
"""
import json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__)) + "/.."
ENV = {}
for line in open(f"{ROOT}/.env"):
    m = re.match(r'^([A-Z_]+)=(.*)$', line.strip())
    if m: ENV[m.group(1)] = m.group(2).strip().strip('"').strip("'")
STORE = ENV["SHOPIFY_STORE"]
THEMES = {"live": "150554902630", "staging": "150783361126"}
R = json.load(open(f"{ROOT}/shopify-app/copy-rewrites.json"))

def proxy(method, path, body=None):
    url = f"https://theme-kit-access.shopifyapps.com/cli/admin/api/2025-07/{path}"
    r = urllib.request.Request(url, data=json.dumps(body).encode() if body else None, method=method,
        headers={"X-Shopify-Access-Token": ENV["SHOPIFY_CLI_THEME_TOKEN"], "X-Shopify-Shop": STORE, "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(r))

def dash(s, found=None):
    """Naomi's rule: no em dashes anywhere in the copy - a plain hyphen instead."""
    if "\u2014" in s or "&mdash;" in s:
        s = s.replace(" \u2014 ", " - ").replace("\u2014", " - ").replace(" &mdash; ", " - ").replace("&mdash;", "-").replace("  - ", " - ")
        if found is not None: found.append("em dash")
    return s

def walk(o, fn):
    if isinstance(o, dict):  return {k: walk(v, fn) for k, v in o.items()}
    if isinstance(o, list):  return [walk(v, fn) for v in o]
    if isinstance(o, str):   return fn(o)
    return o

def run_theme(name, write):
    tid = THEMES[name]
    keys = [a["key"] for a in proxy("GET", f"themes/{tid}/assets.json")["assets"]
            if a["key"].endswith(".json") and (a["key"].startswith("templates/") or a["key"].startswith("sections/") or a["key"] == "config/settings_data.json")]
    for key in keys:
        raw = proxy("GET", f"themes/{tid}/assets.json?asset[key]={key}")["asset"].get("value")
        if not raw: continue
        try: d = json.loads(raw)
        except Exception: continue
        found = []
        def fn(s):
            for k, v in R.items():
                if k in s: s = s.replace(k, v); found.append(k[:50])
            return dash(s, found)
        d2 = walk(d, fn)
        if found:
            print(f"{name} {key}: {len(found)} change(s)")
            for f in found: print("   ·", f)
            if write:
                proxy("PUT", f"themes/{tid}/assets.json", {"asset": {"key": key, "value": json.dumps(d2, indent=2, ensure_ascii=False)}})
                print("   written")

def gql(query, v):
    return json.load(urllib.request.urlopen(urllib.request.Request(
        f"https://{STORE}/admin/api/2025-07/graphql.json", data=json.dumps({"query": query, "variables": v}).encode(),
        headers={"X-Shopify-Access-Token": ENV["SHOPIFY_ADMIN_TOKEN"], "Content-Type": "application/json"})))

def run_content():
    """Em dashes out of product descriptions / headlines / features / enquiry text and the
    Collection pages' location lines and bodies. Series captions (Instagram) and legal pages untouched."""
    d = gql("""{ products(first:50){ nodes{ id handle descriptionHtml
      mf: metafields(first:30, namespace:"custom"){ nodes{ key type value } } } } }""", {})
    for pr in d["data"]["products"]["nodes"]:
        desc = dash(pr["descriptionHtml"] or "")
        mfs = [{"ownerId": pr["id"], "namespace": "custom", "key": m["key"], "type": m["type"], "value": dash(m["value"])}
               for m in pr["mf"]["nodes"] if m["key"] != "series_posts" and m["value"] and dash(m["value"]) != m["value"]]
        if desc != (pr["descriptionHtml"] or ""):
            r = gql('mutation($i:ProductInput!){ productUpdate(input:$i){ userErrors{ message } } }', {"i": {"id": pr["id"], "descriptionHtml": desc}})
            print(pr["handle"], "description:", r["data"]["productUpdate"]["userErrors"] or "updated")
        if mfs:
            r = gql('mutation($m:[MetafieldsSetInput!]!){ metafieldsSet(metafields:$m){ userErrors{ message } } }', {"m": mfs})
            print(pr["handle"], "fields:", [m["key"] for m in mfs], r["data"]["metafieldsSet"]["userErrors"] or "updated")
    d = gql("""{ pages(first:50){ nodes{ id handle body mf: metafields(first:10, namespace:"custom"){ nodes{ key type value } } } } }""", {})
    for pg in d["data"]["pages"]["nodes"]:
        if pg["handle"] in ("privacy", "terms", "accessibility"): continue
        body = dash(pg["body"] or "")
        if body != (pg["body"] or ""):
            r = gql('mutation($id:ID!,$p:PageUpdateInput!){ pageUpdate(id:$id,page:$p){ userErrors{ message } } }', {"id": pg["id"], "p": {"body": body}})
            print(pg["handle"], "body:", r["data"]["pageUpdate"]["userErrors"] or "updated")
        mfs = [{"ownerId": pg["id"], "namespace": "custom", "key": m["key"], "type": m["type"], "value": dash(m["value"])}
               for m in pg["mf"]["nodes"] if m["key"] != "series_posts" and m["value"] and dash(m["value"]) != m["value"]]
        if mfs:
            r = gql('mutation($m:[MetafieldsSetInput!]!){ metafieldsSet(metafields:$m){ userErrors{ message } } }', {"m": mfs})
            print(pg["handle"], "fields:", [m["key"] for m in mfs], r["data"]["metafieldsSet"]["userErrors"] or "updated")

def run_products():
    texts = {
        "capri":  "CAPRI has sold. Leave your details to hear about the next release first.",
        "aether": "AETHER has sold. Leave your details to hear about the next release before it goes to market.",
    }
    q = gql
    for handle, text in texts.items():
        pid = q('query($h:String!){ productByHandle(handle:$h){ id } }', {"h": handle})["data"]["productByHandle"]["id"]
        r = q('mutation($m:[MetafieldsSetInput!]!){ metafieldsSet(metafields:$m){ userErrors{ message } } }',
              {"m": [{"ownerId": pid, "namespace": "custom", "key": "enquiry_text", "type": "multi_line_text_field", "value": text}]})
        print(handle, r["data"]["metafieldsSet"]["userErrors"] or "updated")

mode = sys.argv[1] if len(sys.argv) > 1 else "dry"
if mode == "dry":
    for n in THEMES: run_theme(n, False)
elif mode in THEMES:
    run_theme(mode, True)
elif mode == "products":
    run_products()
    run_content()
