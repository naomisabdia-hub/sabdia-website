#!/usr/bin/env python3
"""Point every residence card block at the residence's PAGE (store-side templates).

    python3 shopify-app/add-residence-page-picks.py <theme-id> [--allow-live]

15 Sep 2026: the residences moved from $0 products to pages. The For Sale
grid and Sold band Residence blocks gained a "Residence page" picker
(setting `page`), the home Current Residences card blocks one called
`residence_page`, More Sabdia residences blocks `page`. A block whose
product is a residence with a page gets that page set; the product pick,
photo, crop and every word typed on the block stay exactly as they were.
Pulls the store-side templates, pushes only what changed. Idempotent.
"""
import json, os, re, subprocess, sys, tempfile
HANDLES = {'qasr', 'solace', 'sierra', 'caspian', 'aether', 'capri'}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = {}
for path in (os.path.join(ROOT, '.env'), os.path.expanduser('~/Desktop/New sabdia website/.env')):
    if os.path.exists(path):
        for line in open(path):
            m = re.match(r'^([A-Z_]+)=(.*)$', line.strip())
            if m:
                env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
        break
STORE = env['SHOPIFY_STORE']
TOKEN = env['SHOPIFY_CLI_THEME_TOKEN']
args = [a for a in sys.argv[1:] if not a.startswith('--')]
if not args:
    sys.exit(__doc__)
theme = args[0]
live = '--allow-live' in sys.argv
files = ['templates/collection.json', 'templates/index.json'] + [f'templates/product.{h}.json' for h in sorted(HANDLES)] + [f'templates/page.residence-{h}.json' for h in sorted(HANDLES)]
tmp = tempfile.mkdtemp(prefix='page-picks-')
cli_env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=TOKEN)
cmd = ['shopify', 'theme', 'pull', '--store', STORE, '--theme', theme, '--path', tmp]
for f in files:
    cmd += ['--only', f]
subprocess.run(cmd, env=cli_env, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
RULES = {  # section type -> (block type, product setting, page setting)
    'collection-grid': ('residence', 'product', 'page'),
    'collection-sold': ('residence', 'product', 'page'),
    'related-properties': ('residence', 'product', 'page'),
    'properties-grid': ('card', 'residence', 'residence_page'),
}
changed = []
for f in files:
    p = os.path.join(tmp, f)
    if not os.path.exists(p):
        continue
    raw = open(p).read()
    head = re.match(r'^\s*(/\*.*?\*/)?', raw, re.S).group(1) or ''
    d = json.loads(raw[len(re.match(r'^\s*(/\*.*?\*/)?', raw, re.S).group(0)):])
    n = 0
    for sec in d.get('sections', {}).values():
        rule = RULES.get(sec.get('type'))
        if not rule:
            continue
        btype, pset, gset = rule
        for b in (sec.get('blocks') or {}).values():
            st = b.setdefault('settings', {})
            h = st.get(pset)
            if b.get('type') == btype and h in HANDLES and not st.get(gset):
                st[gset] = h
                n += 1
    if n:
        with open(p, 'w') as out:
            if head:
                out.write(head + '\n')
            json.dump(d, out, indent=2, ensure_ascii=False)
            out.write('\n')
        changed.append(f)
        print(f"  {f}: {n} block(s) now point at their residence page")
if not changed:
    print("Nothing to change.")
    sys.exit(0)
cmd = ['shopify', 'theme', 'push', '--store', STORE, '--theme', theme, '--path', tmp, '--nodelete']
if live:
    cmd.append('--allow-live')
for f in changed:
    cmd += ['--only', f]
r = subprocess.run(cmd, env=cli_env, capture_output=True, text=True)
print('pushed' if r.returncode == 0 else f"push failed: {r.stdout[-400:]} {r.stderr[-400:]}")
