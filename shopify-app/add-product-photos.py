#!/usr/bin/env python3
"""Add every JPG/PNG in a folder to a residence's Media, in file-name order.

    python3 shopify-app/add-product-photos.py solace "/Users/naomidurcau/Downloads/High Res-2/web"

Photos are appended after the existing media, so the hero (first image)
stays as it is; drag to reorder in Products > the residence > Media.
Skips a photo whose file name already exists on the product. Reads
SHOPIFY_STORE and SHOPIFY_ADMIN_TOKEN from .env in the repo root.
"""
import json, mimetypes, os, re, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = {}
for line in open(os.path.join(ROOT, '.env')):
    m = re.match(r'^([A-Z_]+)=(.*)$', line.strip())
    if m:
        env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
STORE, TOKEN = env['SHOPIFY_STORE'], env['SHOPIFY_ADMIN_TOKEN']
API = f"https://{STORE}/admin/api/2025-07/graphql.json"


def gql(query, variables=None):
    req = urllib.request.Request(API, data=json.dumps({"query": query, "variables": variables or {}}).encode(),
                                 headers={"X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json"})
    out = json.load(urllib.request.urlopen(req))
    if out.get('errors'):
        sys.exit(f"API error: {out['errors']}")
    return out['data']


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    handle, folder = sys.argv[1], sys.argv[2]
    if not os.path.isdir(folder):
        sys.exit(f"That folder does not exist: {folder}\nDrag the photo folder from Finder into the Terminal to get its real path.")
    files = sorted(f for f in os.listdir(folder) if f.lower().endswith(('.jpg', '.jpeg', '.png')))
    if not files:
        sys.exit(f"No photos in {folder}")

    prod = gql('query($h:String!){ productByHandle(handle:$h){ id title media(first:250){ nodes{ ... on MediaImage{ image{ url } } } } } }',
               {"h": handle})['productByHandle']
    if not prod:
        sys.exit(f"No product with handle '{handle}'")
    existing = {os.path.basename(n['image']['url']).split('?')[0].lower() for n in prod['media']['nodes'] if n.get('image')}
    todo = []
    for f in files:
        stem = os.path.splitext(f)[0].lower()
        if any(e.startswith(stem) for e in existing):
            print(f"skip {f} (already on {prod['title']})")
        else:
            todo.append(f)
    if not todo:
        print("Nothing to add.")
        return
    print(f"Adding {len(todo)} photos to {prod['title']}…")

    # 1. staged upload targets
    inputs = [{"resource": "IMAGE", "filename": f, "mimeType": mimetypes.guess_type(f)[0] or 'image/jpeg',
               "httpMethod": "POST", "fileSize": str(os.path.getsize(os.path.join(folder, f)))} for f in todo]
    staged = gql('mutation($i:[StagedUploadInput!]!){ stagedUploadsCreate(input:$i){ stagedTargets{ url resourceUrl parameters{name value} } userErrors{message} } }',
                 {"i": inputs})['stagedUploadsCreate']
    if staged['userErrors']:
        sys.exit(staged['userErrors'])

    # 2. upload each file to its target (multipart POST)
    media = []
    for f, t in zip(todo, staged['stagedTargets']):
        boundary = '----sabdia' + str(int(time.time() * 1000))
        body = b''
        for p in t['parameters']:
            body += f'--{boundary}\r\nContent-Disposition: form-data; name="{p["name"]}"\r\n\r\n{p["value"]}\r\n'.encode()
        data = open(os.path.join(folder, f), 'rb').read()
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{f}"\r\nContent-Type: {mimetypes.guess_type(f)[0] or "image/jpeg"}\r\n\r\n'.encode() + data + f'\r\n--{boundary}--\r\n'.encode()
        req = urllib.request.Request(t['url'], data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
        resp = urllib.request.urlopen(req)
        if resp.status not in (200, 201, 204):
            sys.exit(f"upload failed for {f}: {resp.status}")
        print(f"  uploaded {f}")
        media.append({"originalSource": t['resourceUrl'], "mediaContentType": "IMAGE", "alt": f"{prod['title']} - {os.path.splitext(f)[0]}"})

    # 3. attach to the product, in order
    res = gql('mutation($id:ID!,$m:[CreateMediaInput!]!){ productCreateMedia(productId:$id, media:$m){ media{ status } mediaUserErrors{ message } } }',
              {"id": prod['id'], "m": media})['productCreateMedia']
    if res['mediaUserErrors']:
        sys.exit(res['mediaUserErrors'])
    print(f"Done: {len(media)} photos attached to {prod['title']}. They show under '{prod['title']}' in the file picker's Product filter once Shopify finishes processing (about a minute).")


if __name__ == '__main__':
    main()
