"""Take street addresses out of any text the website shows (Naomi, 17 Sep 2026:
never show the address, suburb only; Instagram may keep its own).

    from address_privacy import redact
    redact("Meet Sierra. 📍 6 Dagmar Street, Holland Park West")
    # -> "Meet Sierra. 📍 Holland Park West"

The streets live in address-privacy.json (shared with address-privacy.mjs,
which must stay a line-for-line port of this file).
"""
import json, os, re

DATA = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'address-privacy.json')))

def _either(word):
    return f"[{word[0].upper()}{word[0].lower()}]{re.escape(word[1:])}"

TYPES = '(?:' + '|'.join(x for t in sorted(DATA['types'], key=len, reverse=True) for x in (_either(t), re.escape(t.upper()))) + r')\b'
COLL = '(?:[Cc]ollection|COLLECTION)'
NUM = r'(\d+[A-Za-z]?)\s+'

def _cap(m, word, group=0):
    """Capitalise the replacement only where the original started a sentence."""
    before = m.string[:m.start()].rstrip()
    starts = not before or before[-1] in '.!?' or not before[-1].isalnum() and before[-1] not in ',;:'
    return word[0].upper() + word[1:] if m.group(group)[:1].isupper() and starts else word

def _street(text, st):
    name = '(?:' + r'\s+'.join(re.escape(w) for w in st['name'].split()) + '|' + r'\s+'.join(re.escape(w.upper()) for w in st['name'].split()) + ')'
    sub = re.escape(st['suburb'])
    houses = st['houses']
    sole = next(iter(houses.values())) if len(houses) == 1 else None
    # "the Newman Avenue Collection" -> "our Camp Hill collection"
    text = re.sub(rf"\b(?:[Tt]he|[Oo]ur)\s+{name}\s+{TYPES}\s+{COLL}", lambda m: _cap(m, f"our {st['suburb']} collection"), text)
    text = re.sub(rf"\b{name}\s+{TYPES}\s+{COLL}", lambda m: f"{st['suburb']} collection", text)
    # "on the corner of Buena Vista Avenue, Coorparoo" -> "on a corner in Coorparoo"
    text = re.sub(rf"\b([Oo]n|[Aa]t)\s+the\s+corner\s+of\s+(?:{NUM})?{name}\s+{TYPES}(?:,?\s+(?:in\s+)?{sub}\b)?",
                  lambda m: _cap(m, f"on a corner in {st['suburb']}", 1), text)
    # "on Newman Avenue in Camp Hill" / "at 29A Todd Street, Taringa" -> "in Camp Hill"
    text = re.sub(rf"\b([Oo]n|[Aa]long|[Aa]t)\s+(?:{NUM})?{name}\s+{TYPES}(?:,?\s+(?:in\s+)?{sub}\b)?",
                  lambda m: _cap(m, f"in {st['suburb']}", 1), text)
    # "26 Akala Street, Camp Hill" -> "MILOS, Camp Hill" (or just the suburb when the name is already there)
    def numbered(m):
        house = houses.get(m.group(1)) or houses.get(m.group(1).upper())
        before = text_ref[0][max(0, m.start() - 30):m.start()].lower()
        if house and house.lower() in before:
            house = None
        if m.group(2):
            return f"{house}, {st['suburb']}" if house else st['suburb']
        return house or st['suburb']
    text_ref = [text]
    text = re.sub(rf"{NUM}{name}\s+{TYPES}(,?\s+{sub}\b)?", numbered, text)
    # a bare "Arnold Street" -> "CASA PALMERA", or the suburb when the street had several houses
    text = re.sub(rf"\b{name}\s+{TYPES}", sole or st['suburb'], text)
    return text

UNKNOWN = re.compile(rf"\b\d+[A-Za-z]?(?:[-/]\d+)?\s+(?:[A-Z][a-z]+\s+){{1,3}}{TYPES},?\s*")

def redact(text, unknown=None):
    """Return text without street addresses. `unknown`, a list, collects any
    address that is not in address-privacy.json (those are removed too)."""
    if not text or not isinstance(text, str):
        return text
    for st in DATA['streets']:
        text = _street(text, st)
    def drop(m):
        if unknown is not None: unknown.append(m.group(0).strip())
        return ''
    return UNKNOWN.sub(drop, text)

def redact_json(value, unknown=None):
    """redact() every string inside a JSON value (lists, dicts)."""
    if isinstance(value, str): return redact(value, unknown)
    if isinstance(value, list): return [redact_json(v, unknown) for v in value]
    if isinstance(value, dict): return {k: redact_json(v, unknown) for k, v in value.items()}
    return value
