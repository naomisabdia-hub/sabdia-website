#!/bin/zsh
# Restore the home page template (Naomi's customizer edits as of 14 Sep 2026
# 18:37 - the dusk facade and sneak-peek reel on the Featured residence, every
# section's dials, the Residence card blocks - plus the film band on real
# photographs). The old push-live step that pushed the 10 Sep Desktop copy over
# it is disabled. Pushes only templates/index.json.
#   zsh shopify-app/restore-home-template.sh                # live
#   zsh shopify-app/restore-home-template.sh 150783361126   # staging
set -e
cd "$(dirname "$0")/.."
export SHOPIFY_CLI_THEME_TOKEN=$(grep '^SHOPIFY_CLI_THEME_TOKEN=' .env | cut -d= -f2- | tr -d '"'"'")
STORE=b91p0j-f4.myshopify.com; THEME=${1:-150554902630}
ARGS=(--store $STORE --theme $THEME --path shopify-app/restore-home --only templates/index.json --nodelete --force)
[ "$THEME" = "150554902630" ] && ARGS+=(--allow-live)
shopify theme push "${ARGS[@]}"
