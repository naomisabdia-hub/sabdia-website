#!/usr/bin/env python3
"""Train the site chat (Shopify Inbox agent): build every answer it should
give and, on Naomi's word, write them where the agent reads them.

    python3 shopify-app/train-chat.py            # build docs/CHAT-TRAINING.md + .json, change nothing live
    python3 shopify-app/train-chat.py --write    # also replace the Questions and answers at the end of /pages/inspections

Sources, read live every run so nothing is typed from memory:
  - the residence pages (qasr, solace, sierra, caspian, aether, capri):
    status, suburb, bedrooms, bathrooms, garage, build and land size,
    features and the opening lines of the page text;
  - the Open homes & availability page (/pages/inspections), which Naomi
    edits: each residence's open homes, auction and selling agent. Times
    that have passed are left out;
  - the published Collection pages: name and suburb;
  - shopify-app/chat-training.json: the hand-written answers.
Every answer is suburb only (Naomi, 17 Sep 2026) and passes through
address_privacy.redact as a last check.

The Questions and answers section is the END of /pages/inspections (from its
heading to the end). Everything above it is Naomi's and is never touched.
--write refuses when that section was edited in Shopify since the last
training (applied/chat-training-live.html holds what was last written);
bring the edit into chat-training.json first, or pass --force.
"""
import datetime, html, json, os, re, sys, urllib.request
from zoneinfo import ZoneInfo
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from address_privacy import redact

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, 'shopify-app')
LEDGER = os.path.join(APP, 'applied', 'chat-training-live.html')
RESIDENCES = ['aether', 'sierra', 'solace', 'caspian', 'qasr', 'capri']
AVAILABLE = {'For Sale', 'Under Offer', 'Coming Soon'}
HEADINGS = ('<h2>Questions and answers</h2>', '<h2>Common questions</h2>')
NOW = datetime.datetime.now(ZoneInfo('Australia/Brisbane'))
MONTHS = {m: i + 1 for i, m in enumerate(['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'])}
PRICE = "We don't disclose pricing unless it has been discussed with our Director."

env = {}
for line in open(os.path.join(ROOT, '.env')):
    m = re.match(r'^([A-Z_]+)=(.*)$', line.strip())
    if m: env[m.group(1)] = m.group(2).strip().strip('"').strip("'")

def gql(q, v=None):
    r = urllib.request.Request(f"https://{env['SHOPIFY_STORE']}/admin/api/2025-07/graphql.json", data=json.dumps({"query": q, "variables": v or {}}).encode(), headers={"X-Shopify-Access-Token": env['SHOPIFY_ADMIN_TOKEN'], "Content-Type": "application/json"})
    out = json.load(urllib.request.urlopen(r, timeout=60))
    if out.get('errors'): sys.exit(out['errors'])
    return out['data']

def text(h):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', h or ''))).strip()

def listing(items):
    items = [i for i in items if i]
    return items[0] if len(items) == 1 else ', '.join(items[:-1]) + ' and ' + items[-1] if items else ''

def passed(when):
    """True when a written time ("Saturday 19 September 2026, 9:00 to 9:30am") is over."""
    d = re.search(r'(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})', when)
    if not d or d.group(2).lower() not in MONTHS: return False
    times = re.findall(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)', when, re.I)
    h, mi = 23, 59
    if times:
        th, tm, ap = times[-1]
        h = int(th) % 12 + (12 if ap.lower() == 'pm' else 0); mi = int(tm or 0)
    end = datetime.datetime(int(d.group(3)), MONTHS[d.group(2).lower()], int(d.group(1)), h, mi, tzinfo=NOW.tzinfo)
    return end < NOW

# ---------- live sources ----------
def page(handle):
    nodes = gql('query($q:String!){ pages(first:3, query:$q){ nodes{ id handle title body isPublished updatedAt metafields(first:60, namespace:"custom"){ nodes{ key value } } } } }', {"q": f"handle:{handle}"})['pages']['nodes']
    return next((p for p in nodes if p['handle'] == handle), None)

def residence(handle):
    p = page(handle)
    if not p or not p['isPublished']: return None
    mf = {n['key']: n['value'] for n in p['metafields']['nodes']}
    body = text(p['body'])
    body = re.sub(rf"^{re.escape(p['title'])},\s*[^.]*\.\s*", '', body)   # drop the "NAME, suburb." opener
    desc = ' '.join(re.split(r'(?<=[.!?])\s+', body)[:2]).replace(' — ', ' - ').replace('—', ' - ')
    try: feats = json.loads(mf.get('features') or '[]')
    except ValueError: feats = []
    feats = [f.replace('&', 'and').lower() for f in feats if not re.search(r'bedroom|bathroom', f, re.I)][:6]
    return {"name": p['title'].strip(), "suburb": mf.get('suburb', '').strip(), "status": mf.get('status', '').strip(),
            "beds": mf.get('beds'), "baths": mf.get('baths'), "cars": mf.get('cars'),
            "build": mf.get('build_size'), "land": mf.get('land'), "features": feats, "desc": desc}

def inspections():
    p = page('inspections')
    if not p: sys.exit('No /pages/inspections - run create-inspections-page.py first.')
    body = p['body']
    cut = min([body.find(h) for h in HEADINGS if h in body] or [len(body)])
    top, section = body[:cut], body[cut:]
    homes = {}
    for block in re.split(r'(?=<h2>)', top):
        m = re.match(r'<h2>\s*([A-Z][A-Z ]+?)\s*(?:-|–|—)', block)
        if not m: continue
        name = m.group(1).strip()
        parts = dict((k.strip().lower(), v) for k, v in re.findall(r'<h3>(.*?)</h3>(.*?)(?=<h3>|$)', block, re.S))
        opens = [text(li) for li in re.findall(r'<li>(.*?)</li>', parts.get('open homes', ''), re.S)]
        first_p = re.search(r'<p>(.*?)</p>', parts.get('auction', ''), re.S)
        auction = text(first_p.group(1) if first_p else parts.get('auction', ''))
        agent = re.search(r'Selling agents?:\s*(.+?)\.?\s*(?:</p>|$)', block, re.S)
        homes[name] = {
            "open_homes": [o for o in opens if not passed(o)],
            "passed": [o for o in opens if passed(o)],
            "auction": None if not auction or re.match(r'no auction', auction, re.I) or passed(auction) else auction.rstrip('.'),
            "agent": text(agent.group(1)).rstrip('.') if agent else None,
        }
    return p, top, section, homes

def collection():
    out = []
    after = None
    while True:
        d = gql('query($a:String){ pages(first:50, after:$a){ pageInfo{hasNextPage endCursor} nodes{ handle title body isPublished } } }', {"a": after})['pages']
        for p in d['nodes']:
            if not p['handle'].startswith('collection-') or not p['isPublished']: continue
            m = re.match(r'\s*[^,—–-]+?\s*[—–-]\s*([A-Za-z ]+?)\s+QLD', text(p['body']))
            out.append({"name": p['title'].strip(), "suburb": m.group(1).strip() if m else ''})
        if not d['pageInfo']['hasNextPage']: break
        after = d['pageInfo']['endCursor']
    return sorted(out, key=lambda c: c['name'])

# ---------- the answers ----------
def build():
    res = [r for r in (residence(h) for h in RESIDENCES) if r]
    insp_page, top, section, homes = inspections()
    coll = collection()
    for_sale = [r for r in res if r['status'] in AVAILABLE]
    sold = [r for r in res if r['status'] not in AVAILABLE]
    fill = {"for_sale": listing([f"{r['name']} in {r['suburb']}" for r in for_sale]),
            "for_sale_suburbs": listing(list(dict.fromkeys(r['suburb'] for r in for_sale)))}
    groups = []

    # Open homes overview
    lines = []
    for r in for_sale:
        h = homes.get(r['name'].upper(), {})
        if h.get('open_homes'): lines.append(f"{r['name']} in {r['suburb']}: {'; '.join(h['open_homes'])}")
    auctions = [f"{r['name']} in {r['suburb']} goes to auction on {homes[r['name'].upper()]['auction']}" for r in for_sale if homes.get(r['name'].upper(), {}).get('auction')]
    groups.append({"group": "Open homes and auctions this week", "qa": [
        ["Which open homes are coming up?", ('Upcoming open homes: ' + '. '.join(lines) + '. Every other residence is shown by private inspection.') if lines else 'There are no open homes scheduled at the moment. Every residence for sale can be seen by private inspection.'],
        ["Are there any auctions coming up?", ('. '.join(auctions) + '.') if auctions else 'No auctions are scheduled at the moment.'],
    ]})

    for r in for_sale:
        n, u = r['name'], r['suburb']
        h = homes.get(n.upper(), {})
        opens, auction, agent = h.get('open_homes') or [], h.get('auction'), h.get('agent')
        status = {'Under Offer': f"{n} in {u} is under offer. Our team can confirm whether it is still available.",
                  'Coming Soon': f"{n} in {u} is coming soon. Leave your name and email and we will let you know first."}.get(r['status'])
        buy = status or f"Yes. {n} in {u} is for sale. " + ("You can see it at an open home or by private inspection." if opens else "Leave your name and phone number and our team will arrange a private inspection.")
        open_ans = (f"Open homes for {n}: {'; '.join(opens)}. If none of these suit, we can arrange a private inspection." if opens
                    else f"There is no open home scheduled for {n} at the moment. Inspections are by private appointment: leave your name and phone number and our team will arrange a time.")
        size = f"a {r['build']} m² home on {r['land']} m² of land" if r['build'] and r['land'] else ''
        rooms = f"{r['beds']} bedrooms, {r['baths']} bathrooms and a {r['cars']}-car garage" if r['beds'] else ''
        qa = [
            [f"Can I buy {n}?", buy],
            [f"Is {n} still available?", status or f"Yes, {n} in {u} is for sale today. Our team can confirm the latest and arrange a private inspection."],
            [f"Is there a residence called {n}?", f"Yes. {n} is a Sabdia residence in {u}, and it is {'for sale' if r['status'] == 'For Sale' else r['status'].lower()}."],
            [f"Tell me about {n}", ' '.join(x for x in [f"{n} is in {u}.", r['desc'], f"It is {size}, with {rooms}." if rooms and size else ''] if x)],
            [f"Where is {n}?", f"{n} is in {u}. For inspection details, leave your name and phone number and our team will be in touch."],
            [f"What is the address of {n}?", f"{n} is in {u}. For inspection details, leave your name and phone number and our team will be in touch."],
            [f"How many bedrooms does {n} have?", f"{n} has {rooms}." if rooms else f"Our team can confirm the details of {n}."],
            [f"How big is {n}?", f"{n} is {size} in {u}." if size else f"Our team can confirm the details of {n}."],
            [f"What features does {n} have?", f"{n} includes {listing(r['features'])}." if r['features'] else f"Our team can walk you through {n}."],
            [f"How much is {n}?", f"{PRICE} Leave your name and phone number and our team will be in touch about {n}."],
            [f"When is the open home for {n}?", open_ans],
            [f"Can I inspect {n}?", open_ans],
            [f"Is there an auction for {n}?", f"Yes. {n} goes to auction on {auction}." if auction else f"No auction is scheduled for {n} at the moment. Our team can talk you through how it is being offered."],
            [f"Who is the selling agent for {n}?", f"{n} is for sale with {agent}. You can also leave your details here and our team will pass them on." if agent else f"Leave your name and phone number and our team will put you in touch about {n}."],
        ]
        groups.append({"group": f"{n} ({u}) - for sale", "qa": qa})

    for r in sold:
        n, u = r['name'], r['suburb']
        why = 'sold prior to completion' if 'prior' in r['status'].lower() else 'has sold'
        nearby = [x for x in for_sale if x['suburb'] == u]
        alt = f"{listing([x['name'] for x in nearby])}, also in {u}, {'is' if len(nearby) == 1 else 'are'} for sale." if nearby else "We can let you know first about our next releases."
        groups.append({"group": f"{n} ({u}) - sold", "qa": [
            [f"Can I buy {n}?", f"{n} in {u} {why}, so it isn't available. {alt}"],
            [f"Is there a residence called {n}?", f"Yes. {n} is a Sabdia residence in {u}. It {why}, so it isn't available."],
            [f"Tell me about {n}", ' '.join(x for x in [f"{n} is in {u}.", r['desc'], f"It {why}."] if x)],
            [f"Where is {n}?", f"{n} is in {u}. It {why} and is privately owned."],
        ]})

    qa = []
    for c in coll:
        n, u = c['name'], c['suburb']
        where = f" in {u}" if u else ''
        qa.append([f"Can I buy {n}?", f"{n}{where} is part of The Collection: a completed Sabdia residence that has been sold and is privately owned, so it isn't for sale and can't be inspected. We can let you know first about our next releases."])
        qa.append([f"Where is {n}?", f"{n} is{where or ' a completed Sabdia residence'}. It is privately owned, so it can't be visited."])
    groups.append({"group": "The Collection (sold, privately owned)", "qa": qa})
    groups[0]['qa'].append(["Which residences have sold?", f"{listing([r['name'] + ' in ' + r['suburb'] + ' ' + ('sold prior to completion' if 'prior' in r['status'].lower() else 'has sold') for r in sold])}. The homes in The Collection ({listing([c['name'] for c in coll])}) are sold and privately owned." if sold else f"The homes in The Collection ({listing([c['name'] for c in coll])}) are sold and privately owned."])

    hand = json.load(open(os.path.join(APP, 'chat-training.json')))
    for g in hand['groups']:
        groups.append({"group": g['group'], "qa": [[q, a.format(**fill)] for q, a in g['qa']]})

    unknown = []
    for g in groups:
        g['qa'] = [[redact(q, unknown), redact(a, unknown)] for q, a in g['qa']]
    if unknown: print('Removed addresses not in address-privacy.json:', unknown)
    return insp_page, top, section, homes, groups

def render_html(groups):
    out = [HEADINGS[0], f'<p>Straight answers for common questions, updated {NOW.strftime("%-d %B %Y")}.</p>']
    for g in groups:
        out.append(f'<h3>{html.escape(g["group"])}</h3>')
        for q, a in g['qa']:
            out.append(f'<p><strong>{html.escape(q)}</strong><br>{html.escape(a)}</p>')
    return '\n'.join(out) + '\n'

def render_md(groups, homes):
    lines = [f"# Site chat - every answer it is trained on", "",
             f"Built {NOW.strftime('%-d %B %Y, %-I:%M')}{NOW.strftime('%p').lower()} from the live site by `shopify-app/train-chat.py`. "
             "Per-residence answers come from the residence pages and the Open homes & availability page; the rest from `shopify-app/chat-training.json`. Suburb only, never a street.", ""]
    gone = {n: h['passed'] for n, h in homes.items() if h.get('passed')}
    if gone:
        lines += ["**Open home times that have passed** (left out of the answers; delete them from the page):", ""]
        lines += [f"- {n}: {'; '.join(t)}" for n, t in gone.items()] + [""]
    for g in groups:
        lines += [f"## {g['group']}", ""]
        for q, a in g['qa']:
            lines += [f"**{q}**", f"{a}", ""]
    return '\n'.join(lines)

def main():
    write, force = '--write' in sys.argv, '--force' in sys.argv
    insp, top, section, homes, groups = build()
    total = sum(len(g['qa']) for g in groups)
    open(os.path.join(ROOT, 'docs', 'CHAT-TRAINING.md'), 'w').write(render_md(groups, homes))
    json.dump({"built": NOW.isoformat(), "groups": groups}, open(os.path.join(APP, 'applied', 'chat-training-bank.json'), 'w'), ensure_ascii=False, indent=1)
    print(f"{total} answers in {len(groups)} groups -> docs/CHAT-TRAINING.md")
    for n, h in homes.items():
        if h.get('passed'): print(f"  {n}: passed and left out: {'; '.join(h['passed'])}")
    if not write:
        print('Nothing changed on the site (add --write to train the chat).'); return
    last = open(LEDGER).read() if os.path.exists(LEDGER) else None
    if section and section != last and not force:
        sys.exit('The Questions and answers on /pages/inspections were edited in Shopify since the last training.\n'
                 'Bring that edit into shopify-app/chat-training.json first (or pass --force to replace it).')
    new_section = render_html(groups)
    res = gql('mutation($id:ID!,$p:PageUpdateInput!){ pageUpdate(id:$id, page:$p){ page{ handle } userErrors{ field message } } }',
              {"id": insp['id'], "p": {"body": top.rstrip() + '\n' + new_section}})['pageUpdate']
    if res['userErrors']: sys.exit(res['userErrors'])
    live = page('inspections')['body']
    cut = min(live.find(h) for h in HEADINGS if h in live)
    os.makedirs(os.path.dirname(LEDGER), exist_ok=True)
    open(LEDGER, 'w').write(live[cut:])
    print(f"Trained: {total} answers written to /pages/inspections (the part above them is untouched).")

if __name__ == '__main__':
    main()
