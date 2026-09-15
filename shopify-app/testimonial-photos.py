#!/usr/bin/env python3
"""Give every review in the home page Testimonials section its own photograph
(Naomi, 15 Sep 2026: "the images that pop up need to be different from any
of the photos on the page so however many testimonials there are should have
a different image, very beautiful ones but different from what we have on
the page").

Until now the nine Review blocks had no photo of their own, so the three
section fallbacks (SIERRA and SOLACE photographs also shown elsewhere) turned
with the words. The pool below is 14 real photographs of completed Sabdia
residences, one or two per house across all ten, chosen from Products > Media
because none of them (nor another shot of the same view) appears anywhere
else on the home page: not the hero, Featured residence, the About strip's
20, the Current residences cards, the film band carousel and poster, or the
fallbacks. Each crops well to the 4:5 portrait panel (and the 4:3 frame on
phones). No render, no SIERRA, SOLACE, QASR, CASPIAN, CAPRI or AETHER file.
Ranked: the first nine serve today's nine reviews, the rest wait for new ones.

Pulls templates/index.json from a theme and, in block order, sets each Review
block's Photo to the next pool photograph and its Photo description to a
short alt text. Run again any time: a review already showing a pool photo
that no earlier review has keeps it (and its description, if one is set);
no two reviews ever share a photo; a pool photo the template shows in another
section is passed over; reviews beyond the pool are left as they are and
listed. Quotes, names, stars, the fallback photos and every other section
stay exactly as they are. Pushes only when something changed.

  python3 shopify-app/testimonial-photos.py 150783361126     # staging
  python3 shopify-app/testimonial-photos.py 150554902630     # live (Naomi)
"""
import json, os, re, shutil, subprocess, sys, tempfile

STORE = "b91p0j-f4.myshopify.com"
LIVE = "150554902630"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREFIX = "shopify://shop_images/"
POOL = [  # file, alt (ranked; first nine for today's nine reviews)
    ("hermosa-dining-01.jpg", "HERMOSA, the dining room beneath its curved double-height ceiling"),
    ("encanto-alfresco-03.jpg", "ENCANTO, the courtyard table among the olive trees"),
    ("alhambra-staircase-01.jpg", "ALHAMBRA, the curved staircase and arched niche"),
    ("kirra-bedroom-02.jpg", "KIRRA, a bedroom in afternoon light"),
    ("ammos-alfresco-02.jpg", "AMMOS, the courtyard looking up to the pool"),
    ("petra-bathroom-03.jpg", "PETRA, the travertine bathroom and arched mirror"),
    ("spectre-living-03.jpg", "SPECTRE, the double-height living room"),
    ("haven-kitchen-detail-02.jpg", "HAVEN, the arched stone niche in the kitchen"),
    ("hermosa-facade-detail-01.jpg", "HERMOSA, the stone arches outside"),
    ("milos-master-bedroom-01.jpg", "MILOS, the main bedroom and its arched windows"),
    ("petra-living-02.jpg", "PETRA, sunlight through the living room curtains"),
    ("eden-bedroom-01.jpg", "EDEN, a chair by the bedroom window"),
    ("encanto-entry-02.jpg", "ENCANTO, the entry beneath the staircase"),
    ("haven-living-03.jpg", "HAVEN, the sitting room and its arched window"),
]

def env_val(key):
    for line in open(os.path.join(ROOT, ".env")):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(f"{key} missing from .env")

def sh(*args, **kw):
    print("$", " ".join(args))
    return subprocess.run(args, check=True, **kw)

def name(v):
    return v.rsplit("/", 1)[-1] if isinstance(v, str) and v.startswith(PREFIX) else ""

def used_elsewhere(data, skip):
    """File names of every shop image the template shows outside the Testimonials sections."""
    text = json.dumps({k: s for k, s in data["sections"].items() if k not in skip})
    return set(re.findall(re.escape(PREFIX) + r'([^"\\]+)', text))

def assign(data):
    """Set the Review photos in place. Returns True when anything changed."""
    alt_of = dict(POOL)
    keys = [k for k, s in data["sections"].items() if s.get("type") == "testimonial"]
    if not keys:
        print("No Testimonials section on the home page.")
        return False
    elsewhere = used_elsewhere(data, keys)
    for f in [f for f, _ in POOL if f in elsewhere]:
        print(f"  {f} is shown in another section, passed over")
    before = json.dumps(data, sort_keys=True)
    taken = set()  # one photo per review across every Testimonials section
    for key in keys:
        sec = data["sections"][key]
        blocks = sec.get("blocks") or {}
        reviews = [b for b in sec.get("block_order", list(blocks)) if blocks.get(b, {}).get("type") == "review"]
        print(f"Testimonials ({key}): {len(reviews)} reviews")
        keep = {}
        for bid in reviews:
            f = name(blocks[bid].get("settings", {}).get("photo"))
            if f in alt_of and f not in taken and f not in elsewhere:
                keep[bid] = f
                taken.add(f)
        for i, bid in enumerate(reviews, 1):
            st = blocks[bid].setdefault("settings", {})
            f = keep.get(bid)
            if f is None:
                free = [p for p, _ in POOL if p not in taken and p not in elsewhere]
                if not free:
                    print(f"  {i:2d}. {bid}: skipped, more reviews than pool photographs ({len(POOL)}); add to POOL")
                    continue
                f = free[0]
                taken.add(f)
                old = name(st.get("photo")) or st.get("photo") or "no photo"
                st["photo"] = PREFIX + f
                st["photo_alt"] = alt_of[f]
                print(f"  {i:2d}. {f}   (was {old})")
            else:
                if not (st.get("photo_alt") or "").strip():
                    st["photo_alt"] = alt_of[f]
                print(f"  {i:2d}. {f}   (kept)")
    return json.dumps(data, sort_keys=True) != before

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    theme = sys.argv[1]
    files = [f for f, _ in POOL]
    assert len(set(files)) == len(files) and not any("-render-" in f for f in files)
    assert not any("—" in a or "–" in a for _, a in POOL)
    env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=env_val("SHOPIFY_CLI_THEME_TOKEN"))
    work = tempfile.mkdtemp(prefix="testimonial-photos-")
    rel = "templates/index.json"
    sh("shopify", "theme", "pull", "--store", STORE, "--theme", theme, "--path", work, "--only", rel, env=env)
    path = os.path.join(work, rel)
    raw = open(path).read()
    data = json.loads(re.sub(r"^\s*/\*.*?\*/\s*", "", raw, count=1, flags=re.S))
    if not assign(data):
        print("Every review already shows its own photograph."); shutil.rmtree(work); return
    open(path, "w").write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    args = ["shopify", "theme", "push", "--store", STORE, "--theme", theme, "--path", work, "--nodelete", "--force", "--only", rel]
    if theme == LIVE:
        args.append("--allow-live")
    sh(*args, env=env)
    shutil.rmtree(work)

if __name__ == "__main__":
    main()
