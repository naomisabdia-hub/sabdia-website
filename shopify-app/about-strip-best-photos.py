#!/usr/bin/env python3
"""Fill the home page About image strip with the 20 best photographs across
every Sabdia residence (Naomi, 15 Sep 2026: "go through all the images in
the picker and select the top 20 best images across all properties, real
life not renders"). Chosen from all 376 photographs in Products > Media
(QASR, CASPIAN and CAPRI hold renders only and are left out; no -render-
file is ever used). Ordered so the two strip slots, which show neighbours
in this list, pair an exterior with an interior from different houses.

Pulls templates/index.json from a theme, replaces every Strip image block
in the About section with these 20 (paragraph and value blocks, and every
section setting, are left exactly as they are) and pushes the template
back. Run again any time; it always lands on the same 20.

  python3 shopify-app/about-strip-best-photos.py 150783361126     # staging
  python3 shopify-app/about-strip-best-photos.py 150554902630     # live (Naomi)
"""
import json, os, re, shutil, subprocess, sys, tempfile

STORE = "b91p0j-f4.myshopify.com"
LIVE = "150554902630"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BEST = [  # file, alt, crop focus
    ("aether-exterior-front-dusk-01.jpg", "AETHER, the street elevation at dusk", "center"),
    ("solace-staircase-02.jpg", "SOLACE, the curved staircase", "center"),
    ("alhambra-exterior-rear-dusk-01.jpg", "ALHAMBRA, the rear elevation and pool at dusk", "center"),
    ("hermosa-ensuite-01.jpg", "HERMOSA, the ensuite with its freestanding bath", "center"),
    ("milos-exterior-rear-dusk-01.jpg", "MILOS, the rear elevation at dusk", "center"),
    ("sierra-dressing-room-01.jpg", "SIERRA, the dressing room", "center"),
    ("petra-pool-dusk-01.jpg", "PETRA, the pool at dusk", "center"),
    ("alhambra-ensuite-03.jpg", "ALHAMBRA, the bath between arches", "center"),
    ("sierra-exterior-front-dusk-01.jpg", "SIERRA, the street elevation at dusk", "center"),
    ("ammos-walk-in-robe-01.jpg", "AMMOS, the main bedroom through to the robe", "center"),
    ("hermosa-exterior-front-dusk-01.jpg", "HERMOSA, the street elevation at dusk", "center"),
    ("aether-ensuite-01.jpg", "AETHER, the ensuite beneath its domed ceiling", "center"),
    ("spectre-facade-detail-01.jpg", "SPECTRE, the curved entry wall and stone", "center"),
    ("petra-kitchen-01.jpg", "PETRA, the travertine kitchen", "center"),
    ("aether-alfresco-pool-dusk-01.jpg", "AETHER, the alfresco and pool at dusk", "center"),
    ("encanto-kitchen-detail-01.jpg", "ENCANTO, the fluted kitchen island", "center"),
    ("haven-exterior-rear-pool-01.jpg", "HAVEN, the rear elevation and pool", "center"),
    ("kirra-hallway-pool-01.jpg", "KIRRA, the hallway looking out to the pool", "right"),
    ("alhambra-living-02.jpg", "ALHAMBRA, the living room and arched niche", "center"),
    ("spectre-kitchen-detail-04.jpg", "SPECTRE, the stone benchtop in the kitchen", "center"),
]

def env_val(key):
    for line in open(os.path.join(ROOT, ".env")):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(f"{key} missing from .env")

def sh(*args, **kw):
    print("$", " ".join(args))
    return subprocess.run(args, check=True, **kw)

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    theme = sys.argv[1]
    assert not any("-render-" in f for f, _, _ in BEST)
    env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=env_val("SHOPIFY_CLI_THEME_TOKEN"))
    work = tempfile.mkdtemp(prefix="about-strip-")
    rel = "templates/index.json"
    sh("shopify", "theme", "pull", "--store", STORE, "--theme", theme, "--path", work, "--only", rel, env=env)
    path = os.path.join(work, rel)
    raw = open(path).read()
    data = json.loads(re.sub(r"^\s*/\*.*?\*/\s*", "", raw, count=1, flags=re.S))
    sec = next((s for s in data["sections"].values() if s.get("type") == "home-about"), None)
    if sec is None:
        print("No About section on the home page."); shutil.rmtree(work); return
    blocks = sec.setdefault("blocks", {})
    order = sec.setdefault("block_order", list(blocks))
    now = [blocks[b]["settings"].get("image", "").rsplit("/", 1)[-1] for b in order if blocks[b].get("type") == "image"]
    if now == [f for f, _, _ in BEST]:
        print("The About strip already shows the 20 best photographs."); shutil.rmtree(work); return
    for bid in [b for b in order if blocks[b].get("type") == "image"]:
        del blocks[bid]
    rest = [b for b in order if b in blocks]
    new = []
    for i, (f, alt, focus) in enumerate(BEST, 1):
        bid = f"image_best_{i:02d}"
        blocks[bid] = {"type": "image", "settings": {"image": "shopify://shop_images/" + f, "ext": "", "alt": alt, "focus": focus}}
        new.append(bid)
        print(f"  {i:2d}. {f}")
    sec["block_order"] = new + rest
    open(path, "w").write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    args = ["shopify", "theme", "push", "--store", STORE, "--theme", theme, "--path", work, "--nodelete", "--force", "--only", rel]
    if theme == LIVE:
        args.append("--allow-live")
    sh(*args, env=env)
    shutil.rmtree(work)

if __name__ == "__main__":
    main()
