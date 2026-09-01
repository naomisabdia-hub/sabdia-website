#!/usr/bin/env python3
"""One-shot store seeding: mirrors the Sabdia site's content into Shopify.

Reads properties + journal from Supabase (falling back to the bundled
seeds) and creates products (with metafields + images), collections,
navigation, pages and the Journal blog. Idempotent: existing handles are
updated/skipped, so it can be re-run safely.

⛔ Content rule: this script only ever copies EXISTING real media URLs —
it never generates imagery.
"""
import json, os, re, sys, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.abspath(__file__)) + "/.."
VERCEL = "https://sabdia-website.vercel.app"

ENV = {}
for line in open(f"{ROOT}/.env"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1)
        ENV[k] = v.strip().strip('"').strip("'")

STORE, TOKEN = ENV["SHOPIFY_STORE"], ENV["SHOPIFY_ADMIN_TOKEN"]
SUPA = ENV.get("SUPABASE_URL") or ENV.get("PUBLIC_SUPABASE_URL")
SKEY = ENV.get("SUPABASE_ANON_KEY") or ENV.get("PUBLIC_SUPABASE_ANON_KEY")
API = f"https://{STORE}/admin/api/2026-07/graphql.json"

def gql(query, variables=None):
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    req = urllib.request.Request(API, body, {
        "X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        out = json.load(r)
    if out.get("errors"):
        raise RuntimeError(json.dumps(out["errors"])[:500])
    return out["data"]

def errs(payload):
    for k in ("userErrors", "mediaUserErrors"):
        if payload.get(k):
            return payload[k]
    return None

SRK = ENV.get("SUPABASE_SERVICE_ROLE_KEY")

def supa(path, key=None):
    key = key or SKEY
    if not (SUPA and key):
        return None
    req = urllib.request.Request(SUPA + path, headers={"apikey": key, "Authorization": f"Bearer {key}"})
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r)
    except Exception as e:
        print(f"  supabase fetch failed ({e}); using seed")
        return None

seed = json.load(open(f"{ROOT}/src/lib/seed-content.json"))

# ── Properties ──────────────────────────────────────────────────────────
rows = supa("/rest/v1/properties?select=*&order=display_order")
if not rows:
    rows = json.load(open(f"{ROOT}/src/lib/seed-properties.json"))

def absolutize(src):
    if not src:
        return None
    return VERCEL + src if src.startswith("/") else src

MEDIA_KEY = re.compile(r"/media/([^/~]+)")
def media_key(src):
    m = MEDIA_KEY.search(src or "")
    return m.group(1) if m else src

# Same clean-up as src/lib/db.js cleanGalleries: one entry per underlying
# asset, and no other property's hero image inside a gallery.
hero_owner = {media_key(r.get("image")): r["slug"] for r in rows}
for r in rows:
    seen, out = set(), []
    for g in r.get("gallery") or []:
        k = media_key(g.get("src"))
        owner = hero_owner.get(k)
        if k in seen or (owner and owner != r["slug"]):
            continue
        seen.add(k)
        out.append(g)
    r["gallery"] = out

films_by = (seed.get("films") or {}).get("byProperty") or {}
wt_by = (seed.get("walkthroughs") or {}).get("byProperty") or {}
series_by = (seed.get("series") or {}).get("byProject") or {}

def mf(key, type_, value):
    if value in (None, "", []):
        return None
    if type_ == "boolean":
        value = "true" if value else "false"
    elif type_ in ("list.single_line_text_field", "json"):
        value = json.dumps(value)
    else:
        value = str(value)
    return {"namespace": "custom", "key": key, "type": type_, "value": value}

def product_metafields(r):
    slug = r["slug"]
    film = films_by.get(slug) or {}
    wt = wt_by.get(slug) or {}
    fields = [
        mf("suburb", "single_line_text_field", r.get("suburb")),
        mf("state", "single_line_text_field", r.get("state") or "QLD"),
        mf("headline", "single_line_text_field", r.get("headline")),
        mf("beds", "number_integer", r.get("beds")),
        mf("baths", "number_integer", r.get("baths")),
        mf("cars", "number_integer", r.get("cars")),
        mf("land", "number_integer", r.get("land")),
        mf("land_over", "boolean", bool(r.get("land_over"))),
        mf("features", "list.single_line_text_field", r.get("features") or []),
        mf("enquiry_heading", "single_line_text_field", r.get("enquiry_heading")),
        mf("enquiry_text", "multi_line_text_field", r.get("enquiry_text")),
        mf("enquiry_button", "single_line_text_field", r.get("enquiry_button")),
        mf("brochure_url", "single_line_text_field", r.get("brochure_url")),
        mf("film_video", "single_line_text_field", film.get("video")),
        mf("film_poster", "single_line_text_field", film.get("poster")),
        mf("scrollwalk_folder", "single_line_text_field", wt.get("scrollwalk")),
        mf("year", "number_integer", r.get("year")),
        # The Series — real captures of the residence's Instagram posts
        # (date/thumb/caption/video), rendered by sections/series-strip.
        mf("series_posts", "json", series_by.get(slug)),
    ]
    return [f for f in fields if f]

def desc_html(r):
    paras = [p.strip() for p in re.split(r"\n\s*\n", r.get("description") or "") if p.strip()]
    return "".join(f"<p>{p}</p>" for p in paras)

print("── Metafield definitions ──")
DEFS = [
    ("Suburb", "suburb", "single_line_text_field"), ("State", "state", "single_line_text_field"),
    ("Headline", "headline", "single_line_text_field"), ("Bedrooms", "beds", "number_integer"),
    ("Bathrooms", "baths", "number_integer"), ("Garages", "cars", "number_integer"),
    ("Land size (m²)", "land", "number_integer"), ("Land size is 'or more'", "land_over", "boolean"),
    ("Key features", "features", "list.single_line_text_field"),
    ("Enquiry heading", "enquiry_heading", "single_line_text_field"),
    ("Enquiry text", "enquiry_text", "multi_line_text_field"),
    ("Enquiry button", "enquiry_button", "single_line_text_field"),
    ("Brochure URL", "brochure_url", "single_line_text_field"),
    ("Film video URL", "film_video", "single_line_text_field"),
    ("Film poster URL", "film_poster", "single_line_text_field"),
    ("Scroll walkthrough folder", "scrollwalk_folder", "single_line_text_field"),
    ("Year", "year", "number_integer"),
    ("The Series posts", "series_posts", "json"),
]
for name, key, type_ in DEFS:
    d = gql("""mutation($def: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(definition: $def) {
          createdDefinition { id } userErrors { code message } } }""",
        {"def": {"name": name, "namespace": "custom", "key": key, "type": type_,
                 "ownerType": "PRODUCT", "pin": True}})["metafieldDefinitionCreate"]
    ue = errs(d)
    taken = ue and any(u.get("code") in ("TAKEN", "RESERVED_NAMESPACE_KEY") or "taken" in (u.get("message") or "").lower() for u in ue)
    print(f"  {key}: {'exists' if taken else ('ERROR ' + json.dumps(ue))[:120] if ue else 'created'}")

print("── Products ──")
existing = {}
data = gql("query { products(first: 50) { nodes { id handle } } }")
for n in data["products"]["nodes"]:
    existing[n["handle"]] = n["id"]

product_ids = {}
for r in rows:
    slug, sold = r["slug"], (r.get("status") == "sold")
    tags = ["property"] + (["sold"] if sold else [])
    if slug in existing:
        product_ids[slug] = existing[slug]
        print(f"  {slug}: already exists, updating metafields")
        d = gql("""mutation($p: ProductUpdateInput!) {
            productUpdate(product: $p) { product { id } userErrors { field message } } }""",
            {"p": {"id": existing[slug], "tags": tags, "metafields": product_metafields(r)}})
        ue = errs(d["productUpdate"])
        if ue: print(f"    update errors: {json.dumps(ue)[:200]}")
        continue
    d = gql("""mutation($p: ProductCreateInput!) {
        productCreate(product: $p) { product { id handle } userErrors { field message } } }""",
        {"p": {"title": r.get("name") or slug.upper(), "handle": slug,
               "descriptionHtml": desc_html(r), "tags": tags, "status": "ACTIVE",
               "metafields": product_metafields(r)}})
    pc = d["productCreate"]
    ue = errs(pc)
    if ue or not pc.get("product"):
        print(f"  {slug}: CREATE FAILED {json.dumps(ue)[:300]}")
        continue
    pid = pc["product"]["id"]
    product_ids[slug] = pid
    media = []
    hero = absolutize(r.get("image"))
    if hero:
        media.append({"originalSource": hero, "mediaContentType": "IMAGE", "alt": r.get("name") or slug})
    for g in (r.get("gallery") or [])[:6]:
        src = absolutize(g.get("src"))
        if src:
            media.append({"originalSource": src, "mediaContentType": "IMAGE", "alt": g.get("alt") or r.get("name") or slug})
    if media:
        d = gql("""mutation($id: ID!, $media: [CreateMediaInput!]!) {
            productCreateMedia(productId: $id, media: $media) {
              media { id } mediaUserErrors { field message } } }""",
            {"id": pid, "media": media})
        me = errs(d["productCreateMedia"])
        print(f"  {slug}: created, {len(media)} images{' — media errors: ' + json.dumps(me)[:200] if me else ''}")
    else:
        print(f"  {slug}: created, no images found")

print("── Publication (Online Store) ──")
pubs = gql("query { publications(first: 10) { nodes { id name } } }")["publications"]["nodes"]
online = next((p for p in pubs if "online" in (p.get("name") or "").lower()), None)
pub_id = online and online["id"]
print(f"  publication: {online and online['name']}")

def publish(gid):
    if not pub_id:
        return
    d = gql("""mutation($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) { userErrors { field message } } }""",
        {"id": gid, "input": [{"publicationId": pub_id}]})
    ue = errs(d["publishablePublish"])
    if ue and not any("already" in (u.get("message") or "").lower() for u in ue):
        print(f"    publish errors for {gid}: {json.dumps(ue)[:150]}")

for slug, pid in product_ids.items():
    publish(pid)
print(f"  published {len(product_ids)} products")

print("── Collections ──")
def ensure_collection(title, handle, member_ids):
    d = gql("query($q: String!) { collections(first: 5, query: $q) { nodes { id handle } } }",
            {"q": f"handle:{handle}"})
    nodes = [n for n in d["collections"]["nodes"] if n["handle"] == handle]
    if nodes:
        cid = nodes[0]["id"]
        print(f"  {handle}: exists")
    else:
        d = gql("""mutation($input: CollectionInput!) {
            collectionCreate(input: $input) { collection { id } userErrors { field message } } }""",
            {"input": {"title": title, "handle": handle}})
        cc = d["collectionCreate"]
        ue = errs(cc)
        if ue or not cc.get("collection"):
            print(f"  {handle}: CREATE FAILED {json.dumps(ue)[:200]}")
            return
        cid = cc["collection"]["id"]
        print(f"  {handle}: created")
    if member_ids:
        d = gql("""mutation($id: ID!, $productIds: [ID!]!) {
            collectionAddProductsV2(id: $id, productIds: $productIds) {
              userErrors { field message } } }""",
            {"id": cid, "productIds": member_ids})
        ue = errs(d["collectionAddProductsV2"])
        if ue and not all("already" in (u.get("message") or "").lower() for u in ue):
            print(f"    add products: {json.dumps(ue)[:200]}")
    publish(cid)

all_ids = dict(existing); all_ids.update(product_ids)
for_sale_ids = [all_ids[r["slug"]] for r in rows if r.get("status") == "for-sale" and r["slug"] in all_ids]
sold_ids = [all_ids[r["slug"]] for r in rows if r.get("status") == "sold" and r["slug"] in all_ids]
ensure_collection("For Sale", "for-sale", for_sale_ids)
ensure_collection("Sold", "sold", sold_ids)

print("── Pages ──")
def page_html(doc_key):
    doc = seed.get(doc_key) or {}
    if doc_key.startswith("legal_"):
        parts = []
        if doc.get("intro"):
            parts.append(f"<p>{doc['intro']}</p>")
        for s in doc.get("sections") or []:
            parts.append(f"<h2>{s.get('heading','')}</h2>{s.get('bodyHtml','')}")
        if doc.get("updated"):
            parts.append(f"<p><em>{doc['updated']}</em></p>")
        return "".join(parts)
    text = doc.get("intro") or doc.get("text") or ""
    if not text and doc.get("paragraphs"):
        text = " ".join(doc["paragraphs"][:1])
    return f"<p>{text}</p>" if text else "<p></p>"

# Fourth field: the page template suffix (templates/page.<suffix>.json in
# the theme) — the dedicated port each page renders through. None falls
# back to the generic page shell (privacy, accessibility).
PAGES = [
    ("About", "about", "about_page", "about"),
    ("Services", "services", "services_page", "services"),
    ("Projects", "projects", "projects_page", "projects"),
    ("Collection", "collection", "collection_page", "collection"),
    ("Contact", "contact", "contact_page", "contact"),
    ("Agent Access", "agent-access", "agent_page", "agent-access"),
    ("Find Your Home", "find-your-home", "find_home", "find-your-home"),
    ("Privacy Policy", "privacy", "legal_privacy", None),
    ("Accessibility", "accessibility", "legal_accessibility", None),
]
have = gql("query { pages(first: 50) { nodes { id handle templateSuffix } } }")["pages"]["nodes"]
have = {p["handle"]: p for p in have}
for title, handle, key, suffix in PAGES:
    if handle in have:
        if suffix and have[handle].get("templateSuffix") != suffix:
            d = gql("""mutation($id: ID!, $page: PageUpdateInput!) {
                pageUpdate(id: $id, page: $page) { page { id } userErrors { field message } } }""",
                {"id": have[handle]["id"], "page": {"templateSuffix": suffix}})
            ue = errs(d["pageUpdate"])
            print(f"  {handle}: {'ERROR ' + json.dumps(ue)[:150] if ue else 'template set to page.' + suffix}")
        else:
            print(f"  {handle}: exists")
        continue
    page = {"title": title, "handle": handle, "body": page_html(key), "isPublished": True}
    if suffix:
        page["templateSuffix"] = suffix
    d = gql("""mutation($page: PageCreateInput!) {
        pageCreate(page: $page) { page { id } userErrors { field message } } }""",
        {"page": page})
    ue = errs(d["pageCreate"])
    print(f"  {handle}: {'ERROR ' + json.dumps(ue)[:150] if ue else 'created'}")

print("── Navigation ──")
menus = gql("query { menus(first: 20) { nodes { id handle title } } }")["menus"]["nodes"]
main = next((m for m in menus if m["handle"] == "main-menu"), None)
NAV = [("For Sale", "/collections/for-sale"), ("Services", "/pages/services"),
       ("About", "/pages/about"), ("Projects", "/pages/projects"),
       ("Collection", "/pages/collection"), ("Agent Access", "/pages/agent-access")]
items = [{"title": t, "type": "HTTP", "url": u} for t, u in NAV]
if main:
    d = gql("""mutation($id: ID!, $title: String!, $handle: String!, $items: [MenuItemUpdateInput!]!) {
        menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
          menu { id } userErrors { field message } } }""",
        {"id": main["id"], "title": "Main menu", "handle": "main-menu", "items": items})
    ue = errs(d["menuUpdate"])
    print(f"  main-menu: {'ERROR ' + json.dumps(ue)[:200] if ue else 'updated (6 items)'}")
else:
    print("  main-menu not found — leaving theme fallback links in place")

print("── Journal ──")
# RLS blocks anon reads on blog_posts — the service key sees them.
# Drafts import as unpublished articles so nothing is lost in the move.
posts = supa("/rest/v1/blog_posts?select=*&order=created_at.desc", key=SRK) or []

def md_lite(md):
    """Mirror of src/lib/blog.js renderBody — markdown-lite to HTML."""
    def esc(s):
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
    def inline(s):
        s = re.sub(r"\[([^\]]+)\]\((https?://[^\s)]+|/[^\s)]*)\)", r'<a href="\2">\1</a>', s)
        s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
        s = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", s)
        s = re.sub(r"\b(SABDIA|Sabdia)\b", r'<span class="brand-mark">\1</span>', s)
        return s
    out = []
    for raw in re.split(r"\n\s*\n", (md or "").strip()):
        block = raw.strip()
        if not block:
            continue
        e = esc(block)
        if block.startswith("### "):
            out.append(f"<h3>{inline(e[4:])}</h3>")
        elif block.startswith("## "):
            out.append(f"<h2>{inline(e[3:])}</h2>")
        elif e.startswith("&gt;"):
            quote = "<br>".join(re.sub(r"^&gt;\s?", "", l) for l in e.split("\n"))
            out.append(f"<blockquote>{inline(quote)}</blockquote>")
        elif all(l.strip().startswith("- ") for l in block.split("\n")):
            items = "".join(f"<li>{inline(l.strip()[2:])}</li>" for l in e.split("\n"))
            out.append(f"<ul>{items}</ul>")
        else:
            out.append(f"<p>{inline(e).replace(chr(10), '<br>')}</p>")
    return "\n".join(out)

blogs = gql("query { blogs(first: 10) { nodes { id handle } } }")["blogs"]["nodes"]
blog = next((b for b in blogs if b["handle"] == "journal"), None)
if not blog:
    d = gql("""mutation($blog: BlogCreateInput!) {
        blogCreate(blog: $blog) { blog { id handle } userErrors { field message } } }""",
        {"blog": {"title": "The Journal", "handle": "journal"}})
    bc = d["blogCreate"]
    if errs(bc) or not bc.get("blog"):
        print(f"  blog: ERROR {json.dumps(errs(bc))[:200]}")
        blog = None
    else:
        blog = bc["blog"]
        print("  blog: created")
else:
    print("  blog: exists")

if blog and posts:
    arts = gql("query($id: ID!) { blog(id: $id) { articles(first: 100) { nodes { handle } } } }",
               {"id": blog["id"]})["blog"]["articles"]["nodes"]
    art_have = {a["handle"] for a in arts}
    for p in posts:
        if p["slug"] in art_have:
            print(f"  {p['slug']}: exists")
            continue
        article = {"blogId": blog["id"], "title": p.get("title") or p["slug"],
                   "handle": p["slug"], "body": md_lite(p.get("body")),
                   "isPublished": bool(p.get("published")), "author": {"name": p.get("author") or "Sabdia"}}
        if p.get("published_at"):
            article["publishDate"] = p["published_at"]
        if p.get("hero_image"):
            article["image"] = {"url": absolutize(p["hero_image"])}
        if p.get("excerpt"):
            article["summary"] = p["excerpt"]
        d = gql("""mutation($article: ArticleCreateInput!) {
            articleCreate(article: $article) { article { id } userErrors { field message } } }""",
            {"article": article})
        ue = errs(d["articleCreate"])
        print(f"  {p['slug']}: {'ERROR ' + json.dumps(ue)[:200] if ue else 'created'}")
elif blog:
    print("  no published posts found to import")

print("\nDone.")
