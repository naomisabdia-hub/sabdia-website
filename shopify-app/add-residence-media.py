#!/usr/bin/env python3
"""Add a residence's photographs and films to its product Media, named the
Sabdia way (house-room-NN), hero first, in the photographer's order.

    python3 shopify-app/add-residence-media.py milos "/Users/naomidurcau/Downloads/High Res JPG - MILOS"
    python3 shopify-app/add-residence-media.py petra "<photo folder>" --film "<film.mp4>" [--film "<second film>"]

The name map lives in shopify-app/photo-names/<handle>.json: original file
name -> new name (without extension), or null to leave that file out (a
duplicate, an address-marker aerial, a floor plan). "<handle>-hero" goes
first so it is the product's main photo. Files over Shopify's limits
(20 megapixels / 20 MB) are resized to 4000px on the long edge; the rest
upload as they are. Films (mp4/mov, under 1 GB) are attached after the
photos as <handle>-film.mp4, <handle>-film-2.mp4 ... and show under the
product in the file picker. Skips anything already on the product.
"""
import json, mimetypes, os, re, shutil, subprocess, sys, tempfile, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = {}
for line in open(os.path.join(ROOT, '.env')):
    m = re.match(r'^([A-Z_]+)=(.*)$', line.strip())
    if m:
        env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
STORE, TOKEN = env['SHOPIFY_STORE'], env['SHOPIFY_ADMIN_TOKEN']
API = f"https://{STORE}/admin/api/2025-07/graphql.json"
MAX_PX, MAX_BYTES, MAX_MP = 4000, 19 * 1024 * 1024, 20_000_000


def gql(query, variables=None):
    req = urllib.request.Request(API, data=json.dumps({"query": query, "variables": variables or {}}).encode(),
                                 headers={"X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json"})
    out = json.load(urllib.request.urlopen(req))
    if out.get('errors'):
        sys.exit(f"API error: {out['errors']}")
    return out['data']


def web_copy(src, dst):
    """A JPEG at the new name, resized only when Shopify would refuse the original."""
    from PIL import Image, ImageOps
    im = Image.open(src)
    w, h = im.size
    big = w * h > MAX_MP or os.path.getsize(src) > MAX_BYTES or w > 8000 or h > 8000
    if not big and src.lower().endswith(('.jpg', '.jpeg')):
        shutil.copyfile(src, dst)
        return f"{w}x{h}"
    im = ImageOps.exif_transpose(im).convert('RGB')
    if big:
        im.thumbnail((MAX_PX, MAX_PX), Image.LANCZOS)
    im.save(dst, 'JPEG', quality=90, optimize=True, progressive=True)
    return f"{im.size[0]}x{im.size[1]} (from {w}x{h})"


def upload(files, resource):
    """Staged upload of local files; returns the resourceUrl for each, in order."""
    inputs = [{"resource": resource, "filename": os.path.basename(p), "mimeType": mimetypes.guess_type(p)[0] or ('video/mp4' if resource == 'VIDEO' else 'image/jpeg'),
               "httpMethod": "POST", "fileSize": str(os.path.getsize(p))} for p in files]
    staged = gql('mutation($i:[StagedUploadInput!]!){ stagedUploadsCreate(input:$i){ stagedTargets{ url resourceUrl parameters{name value} } userErrors{message} } }',
                 {"i": inputs})['stagedUploadsCreate']
    if staged['userErrors']:
        sys.exit(staged['userErrors'])
    urls = []
    for p, t in zip(files, staged['stagedTargets']):
        boundary = '----sabdia' + str(int(time.time() * 1000))
        body = b''
        for prm in t['parameters']:
            body += f'--{boundary}\r\nContent-Disposition: form-data; name="{prm["name"]}"\r\n\r\n{prm["value"]}\r\n'.encode()
        mime = mimetypes.guess_type(p)[0] or 'application/octet-stream'
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{os.path.basename(p)}"\r\nContent-Type: {mime}\r\n\r\n'.encode() + open(p, 'rb').read() + f'\r\n--{boundary}--\r\n'.encode()
        req = urllib.request.Request(t['url'], data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
        resp = urllib.request.urlopen(req)
        if resp.status not in (200, 201, 204):
            sys.exit(f"upload failed for {p}: {resp.status}")
        print(f"  uploaded {os.path.basename(p)} ({os.path.getsize(p) // 1024} KB)")
        urls.append(t['resourceUrl'])
    return urls


def attach(pid, media):
    res = gql('mutation($id:ID!,$m:[CreateMediaInput!]!){ productCreateMedia(productId:$id, media:$m){ media{ status } mediaUserErrors{ message } } }',
              {"id": pid, "m": media})['productCreateMedia']
    if res['mediaUserErrors']:
        sys.exit(res['mediaUserErrors'])


def main():
    args = sys.argv[1:]
    films = []
    while '--film' in args:
        i = args.index('--film'); films.append(args[i + 1]); del args[i:i + 2]
    if len(args) != 2:
        sys.exit(__doc__)
    handle, folder = args
    names = json.load(open(os.path.join(ROOT, 'shopify-app', 'photo-names', f'{handle}.json')))
    prod = gql('query($h:String!){ productByHandle(handle:$h){ id title media(first:250){ nodes{ mediaContentType ... on MediaImage{ image{ url } } ... on Video{ sources{ url } } } } } }',
               {"h": handle})['productByHandle']
    if not prod:
        sys.exit(f"No product with handle '{handle}'")
    existing = set()
    for n in prod['media']['nodes']:
        if n.get('image'):
            existing.add(os.path.basename(n['image']['url']).split('?')[0].lower())
        for s_ in n.get('sources') or []:
            existing.add(os.path.basename(s_['url']).split('?')[0].lower())
    existing_stems = {os.path.splitext(e)[0] for e in existing}

    ordered = [(src, new) for src, new in names.items() if new]
    ordered.sort(key=lambda p: (0 if p[1].endswith('-hero') else 1))  # hero first, then the map's order
    work = tempfile.mkdtemp(prefix=f'{handle}-media-')
    todo = []
    for src, new in ordered:
        if new.lower() in existing_stems or any(e.startswith(new.lower() + '_') for e in existing_stems):
            print(f"skip {new} (already on {prod['title']})"); continue
        path = os.path.join(folder, src)
        if not os.path.exists(path):
            sys.exit(f"missing: {path}")
        dst = os.path.join(work, new + '.jpg')
        print(f"  {new}.jpg <- {src}: {web_copy(path, dst)}")
        todo.append(dst)
    if todo:
        print(f"Adding {len(todo)} photos to {prod['title']}...")
        urls = upload(todo, 'IMAGE')
        attach(prod['id'], [{"originalSource": u, "mediaContentType": "IMAGE", "alt": f"{prod['title']} - {os.path.splitext(os.path.basename(p))[0]}"} for p, u in zip(todo, urls)])
        print(f"  {len(todo)} photos attached.")
    else:
        print("No new photos.")

    vids = []
    for i, f in enumerate(films, 1):
        new = f"{handle}-film" if i == 1 else f"{handle}-film-{i}"
        if new in existing_stems:
            print(f"skip {new} (already on {prod['title']})"); continue
        if os.path.getsize(f) > 1024 ** 3:
            sys.exit(f"{f} is over 1 GB; re-encode it first")
        ext = os.path.splitext(f)[1].lower() or '.mp4'
        dst = os.path.join(work, new + ext)
        os.symlink(os.path.abspath(f), dst)
        vids.append(dst)
    if vids:
        print(f"Adding {len(vids)} film(s) to {prod['title']}...")
        urls = upload(vids, 'VIDEO')
        attach(prod['id'], [{"originalSource": u, "mediaContentType": "VIDEO", "alt": f"{prod['title']} - {os.path.splitext(os.path.basename(p))[0]}"} for p, u in zip(vids, urls)])
        print(f"  {len(vids)} film(s) attached; Shopify transcodes them over the next few minutes.")
    shutil.rmtree(work)
    print(f"Done. They show under '{prod['title']}' in the file picker's Product filter once Shopify finishes processing.")


if __name__ == '__main__':
    main()
