#!/usr/bin/env python3
"""Put the redirect template on the product of each completed residence
(14 Sep 2026): templates/product.<handle>.json on the theme becomes the
single Residence redirect section, so /products/milos sends visitors to
/pages/collection-milos. Those products only hold the photographs and
film. The templates sit in .shopifyignore (store copies lead for the
residences for sale), so this pushes the seven from the repo on purpose.

    python3 shopify-app/push-product-redirects.py 150783361126   # staging
    python3 shopify-app/push-product-redirects.py 150554902630   # live (Naomi)
"""
import os, shutil, subprocess, sys, tempfile

STORE = "b91p0j-f4.myshopify.com"
LIVE = "150554902630"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HANDLES = ("milos", "petra", "kirra", "hermosa", "encanto", "haven", "spectre")


def env_val(key):
    for line in open(os.path.join(ROOT, ".env")):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(f"{key} missing from .env")


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    theme = sys.argv[1]
    env = dict(os.environ, SHOPIFY_CLI_THEME_TOKEN=env_val("SHOPIFY_CLI_THEME_TOKEN"))
    work = tempfile.mkdtemp(prefix="product-redirects-")
    os.makedirs(os.path.join(work, "templates"))
    only = []
    for h in HANDLES:
        rel = f"templates/product.{h}.json"
        src = os.path.join(ROOT, "shopify-theme", rel)
        if "residence-redirect" not in open(src).read():
            sys.exit(f"{rel} is not the redirect template; not pushing it")
        shutil.copyfile(src, os.path.join(work, rel))
        only += ["--only", rel]
    args = ["shopify", "theme", "push", "--store", STORE, "--theme", theme, "--path", work, "--nodelete", "--force", *only]
    if theme == LIVE:
        args.append("--allow-live")
    print("$", " ".join(args))
    subprocess.run(args, check=True, env=env)
    shutil.rmtree(work)
    print("Redirect templates on:", ", ".join(HANDLES))


if __name__ == "__main__":
    main()
