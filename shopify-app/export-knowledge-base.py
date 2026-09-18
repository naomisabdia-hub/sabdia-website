#!/usr/bin/env python3
"""Turn the trained answers into a list to enter in Apps > Knowledge Base
(Naomi, 18 Sep 2026: "i dont want public page but i want the other items like
feed the chat, 274 answers go to knowledge base").

    python3 shopify-app/train-chat.py                     # rebuild the bank from the live site
    python3 shopify-app/export-knowledge-base.py          # -> docs/KNOWLEDGE-BASE.md

Knowledge Base FAQs are NOT shown on the storefront, which is why they are the
right home now that /pages/inspections is unpublished. Shopify gives no bulk
import, no CSV, no file upload and no API for them, and our app token has no
metaobject scope, so each one is entered by hand: Apps > Knowledge Base >
Add FAQ, question in one box, answer in the other.

Three things keep the list short enough to be enterable:
  - Part 1 is only what the published pages CANNOT answer (open homes, the
    auction, the selling agent, Sold, The Collection, pricing, a real person).
    That is where the agent was inventing. Part 2 is everything else.
  - One FAQ per distinct answer; the other phrasings are listed beside it.
  - The Collection's 24 houses share four sentences, so they become four FAQs
    that name all 24 rather than 96 near-identical ones. This is the only place
    the wording is generalised rather than copied.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BANK = os.path.join(ROOT, 'shopify-app', 'applied', 'chat-training-bank.json')
LOG = os.path.join(ROOT, 'shopify-app', 'query-log.json')
OUT = os.path.join(ROOT, 'docs', 'KNOWLEDGE-BASE.md')
LONG = 250
if not os.path.exists(BANK): sys.exit('No answer bank - run train-chat.py first.')
d = json.load(open(BANK))

COLLECTION = next((g for g in d['groups'] if g['group'].startswith('The Collection')), None)
FIRST_GROUPS = {'Residences for sale, open homes and auctions', 'Open homes and inspections',
                'Sold residences and The Collection', 'Pricing and our Director', "When the chat can't decide"}
FIRST_Q = re.compile(r'^(Can I buy |Is there a residence called |When is the open home |Can I inspect |'
                     r'Is there an auction |Who is the selling agent |How much is |Is there a price guide |'
                     r'Has .* sold\?|Is .* still available\?)', re.I)

def listing(xs):
    return xs[0] if len(xs) == 1 else ', '.join(xs[:-1]) + ' and ' + xs[-1] if xs else ''

def collection_faqs():
    """The 24 houses' four repeated sentences, said once with every name in them."""
    if not COLLECTION: return []
    names = sorted({q.split('Can I buy ')[1].rstrip('?') for q, _ in COLLECTION['qa'] if q.startswith('Can I buy ')})
    if not names: return []
    who = f"The Collection is our completed residences - {listing(names)}."
    return [(COLLECTION['group'], q, a) for q, a in [
        ("Can I buy a home from The Collection?",
         f"{who} Each one has been bought and is privately owned, so Sabdia no longer sells it, and any future sale would be by its owner rather than by us. We can let you know first about our next releases."),
        ("Can I inspect a home in The Collection?",
         f"{who} They are bought and privately owned, so they aren't open for inspection. If you meant one of our residences for sale, tell me which and our team will come back to you."),
        ("Where are The Collection homes?",
         f"{who} They are across Brisbane and privately owned, so they can't be visited. Each one has a page on our website with its photographs."),
        ("What is the price guide for a home in The Collection?",
         f"{who} They aren't for sale and have no price guide from our end. Our Director discusses pricing on the residences we do have for sale - tell me which one interests you and our team will come back to you."),
    ]]

# Part 0: the questions real visitors actually typed (Apps > Knowledge Base >
# Query log), each logged Unanswered. Answer these and every question a buyer
# has really asked is covered - so they go in before anything else.
zero = []
if os.path.exists(LOG):
    log = json.load(open(LOG))
    byq = {q: a for g in d['groups'] for q, a in g['qa']}
    for x in log['queries']:
        a = byq.get(x['answer_to'])
        if not a: sys.exit(f"query-log.json points at a question the bank no longer has: {x['answer_to']}")
        zero.append((f"asked {x['when']}: \u201c{x['asked']}\u201d", x['answer_to'], a))
ZERO_Q = {q for _, q, _ in zero}

first, rest = [], []
for g in d['groups']:
    if COLLECTION and g['group'] == COLLECTION['group']: continue
    for q, a in g['qa']:
        if q in ZERO_Q: continue          # already in Part 0
        (first if g['group'] in FIRST_GROUPS or FIRST_Q.match(q) else rest).append((g['group'], q, a))
first += collection_faqs()

def fold(rows):
    """One row per distinct answer; the other phrasings ride along with it."""
    seen, out = {}, []
    for grp, q, a in rows:
        if a in seen: seen[a][3].append(q); continue
        seen[a] = [grp, q, a, []]
        out.append(seen[a])
    return out

zero_f = [[g, q, a, []] for g, q, a in zero]
first_f, rest_f = fold(first), fold(rest)

def render(rows, n0, heading, blurb):
    lines, n, grp = [f'## {heading}', '', blurb, ''], n0, None
    for g, q, a, alts in rows:
        if g != grp: grp = g; lines += [f'### {g}', '']
        lines += [f'**{n}. {q}**' + ('  `long`' if len(a) > LONG else ''), '', a, '']
        if alts: lines += [f'*Also covers:* {"; ".join(alts)}', '']
        n += 1
    return lines, n

total_faqs = len(zero_f) + len(first_f) + len(rest_f)
head = [
    '# Site chat - the answers to enter in the Knowledge Base', '',
    'Shopify admin > **Apps > Knowledge Base > Add FAQ**: the bold line goes in Question, the text under it in Answer.',
    'None of this is shown on the website. It is only what the chat answers from, which is why it replaces',
    'the unpublished /pages/inspections.', '',
    f'Built by `shopify-app/export-knowledge-base.py` from `train-chat.py` ({d["built"][:10]}). '
    f'{sum(len(g["qa"]) for g in d["groups"])} trained answers become **{total_faqs} FAQs**.', '',
    'Shopify has no bulk import, CSV, file upload or API for these, so they go in by hand.',
    '**Part 1 first** - those are the ones the website pages cannot answer, and the ones the agent was making up.',
    'A few answers are marked `long`: Shopify suggests one or two sentences but does not enforce it, so trim if you want to.', '',
]
b0, n = render(zero_f, 1, f'Part 0 - the questions buyers have actually asked ({len(zero_f)})',
               'Read off Apps > Knowledge Base > Query log on 18 Sep 2026. Every one was logged **Unanswered**. '
               'Enter these first: they are real questions from real visitors, and the answers already exist.')
b1, n = render(first_f, n, f'Part 1 - enter these next ({len(first_f)})',
               'Open homes, the auction, the selling agent, what Sold and The Collection mean, pricing, and reaching a person.')
b2, _ = render(rest_f, n, f'Part 2 - the rest ({len(rest_f)})',
               'Worth having, but the published residence pages, For Sale, The Collection, Process and About already cover most of it.')
open(OUT, 'w').write('\n'.join(head + b0 + b1 + b2) + '\n')
print(f"{sum(len(g['qa']) for g in d['groups'])} answers -> {total_faqs} FAQs "
      f"(Part 0: {len(zero_f)}, Part 1: {len(first_f)}, Part 2: {len(rest_f)}) -> docs/KNOWLEDGE-BASE.md")
print(f"  {sum(1 for r in zero_f + first_f + rest_f if len(r[2]) > LONG)} run longer than Shopify's suggested 1-2 sentences.")
