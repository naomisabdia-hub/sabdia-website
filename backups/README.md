# Theme backups

Full pulls of the LIVE Shopify theme (#150554902630), taken before a round of
changes so the site can be put back exactly.

| Folder | Taken | Why |
|---|---|---|
| `live-theme-2026-09-13/` | 13 Sep 2026, 22:19 AEST | Before the changes from the 11 Sep design review (Mo / Naomi / Matt) |

## To restore a backup to the live theme

```bash
export SHOPIFY_CLI_THEME_TOKEN=$(grep '^SHOPIFY_CLI_THEME_TOKEN=' .env | cut -d= -f2- | tr -d '"'"'")
shopify theme push --store b91p0j-f4.myshopify.com --theme 150554902630 --path backups/live-theme-2026-09-13 --allow-live
```

That pushes code, templates and theme settings together, so the customizer
content goes back too. Restore to staging (#150783361126) first to check.
