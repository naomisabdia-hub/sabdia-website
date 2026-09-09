#!/usr/bin/env python3
"""Make the main menu: For Sale, Collection, Services, About, Agent Access (no Properties dropdown).
    python3 shopify-app/flatten-menu.py
"""
import json, re, os, sys, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = {}
for line in open(os.path.join(ROOT, '.env')):
    m = re.match(r'^([A-Z_]+)=(.*)$', line.strip())
    if m: env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
def gql(q, v=None):
    r = urllib.request.Request(f"https://{env['SHOPIFY_STORE']}/admin/api/2025-07/graphql.json", data=json.dumps({"query": q, "variables": v or {}}).encode(), headers={"X-Shopify-Access-Token": env['SHOPIFY_ADMIN_TOKEN'], "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(r))
mid = [m['id'] for m in gql('{ menus(first:5){nodes{id handle}} }')['data']['menus']['nodes'] if m['handle'] == 'main-menu'][0]
items = [{"title": t, "type": "HTTP", "url": u} for t, u in [
    ("For Sale", "/collections/for-sale"), ("Collection", "/pages/collection"),
    ("Services", "/pages/services"), ("About", "/pages/about"), ("Agent Access", "/pages/agent-access")]]
res = gql('mutation($id:ID!,$i:[MenuItemUpdateInput!]!){ menuUpdate(id:$id,title:"Main menu",items:$i){ menu{items{title}} userErrors{field message} } }', {"id": mid, "i": items})['data']['menuUpdate']
if res['userErrors']: sys.exit(res['userErrors'])
print("Main menu:", " · ".join(i['title'] for i in res['menu']['items']))
