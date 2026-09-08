#!/usr/bin/env python3
"""Plain-English copy pass for the Shopify store.

Replaces the AI-sounding sentences listed in copy-rewrites.json with the
short human ones, everywhere they live on the store side:

  python3 shopify-app/humanise-copy.py dry       # show what would change
  python3 shopify-app/humanise-copy.py staging   # customizer templates on the staging theme
  python3 shopify-app/humanise-copy.py live      # customizer templates on the LIVE theme
  python3 shopify-app/humanise-copy.py products  # CAPRI / AETHER sold-notice text

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

def walk(o, fn):
    if isinstance(o, dict):  return {k: walk(v, fn) for k, v in o.items()}
    if isinstance(o, list):  return [walk(v, fn) for v in o]
    if isinstance(o, str):   return fn(o)
    return o

def run_theme(name, write):
    tid = THEMES[name]
    keys = [a["key"] for a in proxy("GET", f"themes/{tid}/assets.json")["assets"]
            if a["key"].endswith(".json") and (a["key"].startswith("templates/") or a["key"].startswith("sections/"))]
    for key in keys:
        raw = proxy("GET", f"themes/{tid}/assets.json?asset[key]={key}")["asset"].get("value")
        if not raw: continue
        try: d = json.loads(raw)
        except Exception: continue
        found = []
        def fn(s):
            for k, v in R.items():
                if k in s: s = s.replace(k, v); found.append(k[:50])
            return s
        d2 = walk(d, fn)
        if found:
            print(f"{name} {key}: {len(found)} change(s)")
            for f in found: print("   ·", f)
            if write:
                proxy("PUT", f"themes/{tid}/assets.json", {"asset": {"key": key, "value": json.dumps(d2, indent=2, ensure_ascii=False)}})
                print("   written")

def run_products():
    texts = {
        "capri":  "CAPRI has sold. Leave your details to hear about the next release first.",
        "aether": "AETHER has sold. Leave your details to hear about the next release before it goes to market.",
    }
    q = lambda query, v: json.load(urllib.request.urlopen(urllib.request.Request(
        f"https://{STORE}/admin/api/2025-07/graphql.json", data=json.dumps({"query": query, "variables": v}).encode(),
        headers={"X-Shopify-Access-Token": ENV["SHOPIFY_ADMIN_TOKEN"], "Content-Type": "application/json"})))
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
