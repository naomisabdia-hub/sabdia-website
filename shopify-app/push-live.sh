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
echo "Done."
