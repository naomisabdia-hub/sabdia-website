#!/usr/bin/env python3
"""Take every street address off the website (Naomi, 17 Sep 2026: "never show
the address - ensure its private"; suburb only, every house, for sale and in
The Collection; Instagram itself may keep them).

    python3 shopify-app/redact-addresses.py 150554902630           # live: show what would change
    python3 shopify-app/redact-addresses.py 150554902630 --write   # live: change it
    python3 shopify-app/redact-addresses.py 150783361126 --write   # staging

Store data (theme-independent): page text and metafields, product
descriptions, SEO, metafields and photo alt text, blog articles.
Theme: every template, section group and settings_data.json, pulled from the
store, cleaned, and only the changed files pushed back (--only). The rule
lives in address_privacy.py + address-privacy.json. Runs on every push-live:
it only ever removes addresses, so it never undoes a choice of Naomi's.
"""
import difflib, json, os, re, shutil, subprocess, sys, tempfile, glob, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from address_privacy import redact, redact_json

STORE = "b91p0j-f4.myshopify.com"
LIVE = "150554902630"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = {}
for line in open(os.path.join(ROOT, '.env')):
    m = re.match(r'^([A-Z_]+)=(.*)$', line.strip())
    if m: env[m.group(1)] = m.group(2).strip().strip('"').strip("'")

def gql(q, v=None):
    r = urllib.request.Request(f"https://{env['SHOPIFY_STORE']}/admin/api/2025-07/graphql.json", data=json.dumps({"query": q, "variables": v or {}}).encode(), headers={"X-Shopify-Access-Token": env['SHOPIFY_ADMIN_TOKEN'], "Content-Type": "application/json"})
    for attempt in range(4):
        try:
            out = json.load(urllib.request.urlopen(r, timeout=60))
        except OSError as e:
            print('   (Shopify slow, retrying)', e, flush=True); continue
        if out.get('errors') and 'THROTTLED' in json.dumps(out['errors']):
            import time; time.sleep(5); continue
        if out.get('errors'): sys.exit(out['errors'])
        return out['data']
    sys.exit('Shopify did not answer after 4 tries')

def paged(query, fields):
    after = None
    while True:
        d = gql(f'query($a:String){{ {query}(first:10, after:$a){{ pageInfo{{hasNextPage endCursor}} nodes{{ {fields} }} }} }}', {"a": after})[query]
        yield from d['nodes']
        if not d['pageInfo']['hasNextPage']: break
        after = d['pageInfo']['endCursor']

def show(label, old, new):
    print(f"\n~ {label}")
    a = re.split(r'(?<=[.!?>])\s+|(?<=,)\s*(?=")', old); b = re.split(r'(?<=[.!?>])\s+|(?<=,)\s*(?=")', new)
    for line in difflib.unified_diff(a, b, lineterm='', n=0):
        if line.startswith(('---', '+++', '@@')): continue
        print('   ' + line[:220])

def strings(value):
    if isinstance(value, str): yield value
    elif isinstance(value, list):
        for v in value: yield from strings(v)
    elif isinstance(value, dict):
        for v in value.values(): yield from strings(v)

def show_strings(label, value):
    print(f"\n~ {label}")
    for t in strings(value):
        n = redact(t)
        if n != t:
            for line in difflib.unified_diff(re.split(r'(?<=[.!?])\s+', t), re.split(r'(?<=[.!?])\s+', n), lineterm='', n=0):
                if not line.startswith(('---', '+++', '@@')): print('   ' + line[:220])

def errs(res, key):
    ue = res[key].get('userErrors') or []
    if ue: print('   ✖', ue)
    return not ue

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args: sys.exit(__doc__)
    theme, write = args[0], '--write' in sys.argv
    unknown, changes = [], 0

    def clean_metafields(owner_id, label, nodes):
        nonlocal changes
        sets = []
        for mf in nodes:
            v = mf['value']
            try:
                parsed = json.loads(v) if v[:1] in '[{' else None
            except ValueError:
                parsed = None
            if parsed is not None:
                cleaned = redact_json(parsed, unknown)
                if cleaned == parsed: continue
                new = json.dumps(cleaned, ensure_ascii=False, separators=(',', ':'))
                show_strings(f"{label} / {mf['namespace']}.{mf['key']}", parsed)
            else:
                new = redact(v, unknown)
                if new == v: continue
                show(f"{label} / {mf['namespace']}.{mf['key']}", v, new)
            changes += 1
            sets.append({"ownerId": owner_id, "namespace": mf['namespace'], "key": mf['key'], "type": mf['type'], "value": new})
        if sets and write:
            errs(gql('mutation($m:[MetafieldsSetInput!]!){ metafieldsSet(metafields:$m){ userErrors{field message} } }', {"m": sets}), 'metafieldsSet')

    for p in paged('pages', 'id handle body metafields(first:100){nodes{namespace key type value}}'):
        new = redact(p['body'], unknown)
        if new != p['body']:
            show(f"page {p['handle']} / text", p['body'], new); changes += 1
            if write: errs(gql('mutation($id:ID!,$p:PageUpdateInput!){ pageUpdate(id:$id, page:$p){ userErrors{field message} } }', {"id": p['id'], "p": {"body": new}}), 'pageUpdate')
        clean_metafields(p['id'], f"page {p['handle']}", p['metafields']['nodes'])

    for p in paged('products', 'id handle descriptionHtml seo{title description} metafields(first:100){nodes{namespace key type value}} media(first:100){nodes{id alt}}'):
        upd = {}
        new = redact(p['descriptionHtml'], unknown)
        if new != p['descriptionHtml']:
            show(f"product {p['handle']} / description", p['descriptionHtml'], new); upd['descriptionHtml'] = new
        seo = {k: redact(v, unknown) for k, v in p['seo'].items() if v}
        if any(seo[k] != p['seo'][k] for k in seo):
            show(f"product {p['handle']} / seo", json.dumps(p['seo']), json.dumps(seo)); upd['seo'] = seo
        if upd:
            changes += 1
            if write: errs(gql('mutation($p:ProductUpdateInput!){ productUpdate(product:$p){ userErrors{field message} } }', {"p": {"id": p['id'], **upd}}), 'productUpdate')
        alts = [{"id": md['id'], "alt": redact(md['alt'], unknown)} for md in p['media']['nodes'] if md['alt'] and redact(md['alt']) != md['alt']]
        if alts:
            for a in alts: print(f"\n~ product {p['handle']} / photo alt -> {a['alt'][:120]}")
            changes += len(alts)
            if write: errs(gql('mutation($pid:ID!,$m:[UpdateMediaInput!]!){ productUpdateMedia(productId:$pid, media:$m){ mediaUserErrors{field message} userErrors: mediaUserErrors{field message} } }', {"pid": p['id'], "m": alts}), 'productUpdateMedia')
        clean_metafields(p['id'], f"product {p['handle']}", p['metafields']['nodes'])

    for a in paged('articles', 'id handle body summary'):
        upd = {k: redact(a[k], unknown) for k in ('body', 'summary') if a[k] and redact(a[k]) != a[k]}
        if upd:
            for k, v in upd.items(): show(f"article {a['handle']} / {k}", a[k], v)
            changes += 1
            if write: errs(gql('mutation($id:ID!,$a:ArticleUpdateInput!){ articleUpdate(id:$id, article:$a){ userErrors{field message} } }', {"id": a['id'], "a": upd}), 'articleUpdate')

    # The theme: templates, section groups, settings.
    tenv = dict(os.environ)
    for line in open(os.path.join(ROOT, '.env')):
        if line.startswith('SHOPIFY_CLI_THEME_TOKEN='): tenv['SHOPIFY_CLI_THEME_TOKEN'] = line.split('=', 1)[1].strip().strip('"').strip("'")
    work = tempfile.mkdtemp(prefix='redact-addresses-')
    subprocess.run(["shopify", "theme", "pull", "--store", STORE, "--theme", theme, "--path", work, "--no-color",
                    "--only", "templates/*", "--only", "sections/*.json", "--only", "config/settings_data.json"],
                   check=True, env=tenv, stdout=subprocess.DEVNULL)
    changed = []
    for f in sorted(glob.glob(f"{work}/templates/*.json") + glob.glob(f"{work}/sections/*.json") + [f"{work}/config/settings_data.json"]):
        if not os.path.exists(f): continue
        raw = open(f).read()
        body = re.sub(r"^\s*/\*.*?\*/\s*", "", raw, count=1, flags=re.S)
        data = json.loads(body)
        new = redact_json(data, unknown)
        if new == data: continue
        rel = os.path.relpath(f, work)
        show_strings(f"theme {rel}", data)
        header = raw[:len(raw) - len(raw.lstrip())] + (re.match(r"^\s*/\*.*?\*/\s*", raw, re.S).group(0) if re.match(r"^\s*/\*.*?\*/", raw, re.S) else '')
        open(f, 'w').write(header + json.dumps(new, indent=2, ensure_ascii=False) + "\n")
        changed.append(rel); changes += 1
    if changed and write:
        only = sum((["--only", r] for r in changed), [])
        push = ["shopify", "theme", "push", "--store", STORE, "--theme", theme, "--path", work, "--nodelete", "--force", "--no-color", *only]
        if theme == LIVE: push.append("--allow-live")
        subprocess.run(push, check=True, env=tenv)
    shutil.rmtree(work, ignore_errors=True)

    if unknown:
        print("\nStreets not in address-privacy.json (removed; add them so the suburb stays):")
        for u in sorted(set(unknown)): print("  ", u)
    print(f"\n{changes} place(s) {'cleaned' if write else 'would change'}"
          + (f"; theme files pushed: {', '.join(changed)}" if changed and write else '')
          + ('' if write or not changes else ' - run again with --write'))

if __name__ == '__main__':
    main()
