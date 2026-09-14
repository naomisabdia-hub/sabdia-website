#!/bin/zsh
# Push the theme code to the live Sabdia theme, then (if present) the page
# templates edited from the store copy on the Desktop.
#   zsh shopify-app/push-live.sh
set -e
cd "$(dirname "$0")/.."
export SHOPIFY_CLI_THEME_TOKEN=$(grep '^SHOPIFY_CLI_THEME_TOKEN=' .env | cut -d= -f2- | tr -d '"'"'")
STORE=b91p0j-f4.myshopify.com; THEME=150554902630
echo "== theme code"
shopify theme push --store $STORE --path shopify-theme --theme $THEME --allow-live --nodelete
# The per-residence page templates ship on their first push only. After that
# the store copy (Naomi's picked gallery blocks) is the source of truth, so
# they join .shopifyignore like the other templates.
# Theme settings (Enquiry handling = Shopify) ship once too; afterwards the
# customizer copy is the source of truth, so never overwrite it again.
grep -q "^config/settings_data.json" shopify-theme/.shopifyignore || echo "config/settings_data.json" >> shopify-theme/.shopifyignore
for h in qasr solace sierra caspian aether capri; do
  grep -q "^templates/product.$h.json" shopify-theme/.shopifyignore || echo "templates/product.$h.json" >> shopify-theme/.shopifyignore
done
if [ -d "$HOME/Desktop/sabdia-store-templates/templates" ]; then
  echo "== page templates (home, about, services, contact, collection, for-sale, agent - Tamsin review edits 10 Sep 2026)"
  shopify theme push --store $STORE --path "$HOME/Desktop/sabdia-store-templates" --theme $THEME --allow-live --nodelete \
    --only templates/index.json --only templates/page.about.json --only templates/page.services.json --only templates/page.contact.json \
    --only templates/page.collection.json --only templates/page.collection-item.json --only templates/collection.json --only templates/page.agent-access.json --only templates/page.find-your-home.json
fi
# The film section (14 Sep 2026) sits on every residence page template; the
# templates are store-side, so this adds it where it is missing and nothing else.
echo "== The film section on the residence templates"
python3 shopify-app/add-film-section.py $THEME
# The residence page as its own sections (14 Sep 2026): Header, Specs bar,
# Description and enquiry, Gallery, Closing. Moves any template still on the
# all-in-one Property page section over, settings and gallery blocks intact.
echo "== The residence page split into its own sections"
python3 shopify-app/split-property-page.py $THEME
# The residence page arranged as Naomi's sections (14 Sep 2026): Header,
# Property page (specs bar, sold banner, sticky bar), About and enquiry, The
# residence, Private appointments, The film, The Series, More Sabdia
# residences, Scroll walkthrough (hidden unless the residence has one).
# Settings move with their section; nothing Naomi set is lost.
echo "== The residence page arranged into its sections"
python3 shopify-app/arrange-residence-page.py $THEME
# The For Sale page as its own sections (14 Sep 2026): Header, Refine
# toolbar, Now selling, The residences (Residence blocks), Sold band, How it
# works, Private inspections. Moves templates/collection.json off the
# all-in-one Collection grid section, every setting intact.
echo "== The For Sale page split into its own sections"
python3 shopify-app/arrange-collection-page.py $THEME
# One editable Post block per synced post in The Series (14 Sep 2026), so a
# tile can be clicked in the editor and its link changed. Adds only what is
# missing; hand edits survive.
echo "== Post blocks in The Series"
python3 shopify-app/add-series-blocks.py $THEME
# Every card of the home page's Current Residences its own block (14 Sep
# 2026), so a card can be clicked and its photo or link changed. Adds blocks
# only where the grid has none; hand edits survive.
echo "== Residence card blocks in Current Residences"
python3 shopify-app/add-residence-card-blocks.py $THEME
# Every photo of each residence Gallery its own Photo block (14 Sep 2026).
# Adds blocks only where a gallery has none; hand edits survive.
echo "== Photo blocks in the residence galleries"
python3 shopify-app/add-gallery-photo-blocks.py $THEME
echo "Done."
