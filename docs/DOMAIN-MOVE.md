# Moving sabdiaconstructions.com.au from Wix to Shopify

Written 11 Sep 2026. The goal: the domain stops serving the Wix site and
starts serving the Shopify store, but the store stays locked, so anyone
typing the address gets the Sabdia coming-soon page rather than the site.

## What is true today (checked 11 Sep 2026)

| | |
|---|---|
| Domain | **sabdiaconstructions.com.au** (plural). The singular `sabdiaconstruction.com.au` is not registered to anyone. |
| Registrar | **GoDaddy**, registrant Muhammad Sabdia. The domain is not owned by Wix. |
| Nameservers | `ns6.wixdns.net`, `ns7.wixdns.net` — Wix answers all DNS for the domain. |
| A record | `185.230.63.171`, `185.230.63.107`, `185.230.63.186` (Wix) |
| www | CNAME → `cdn3.wixdns.net` |
| MX | **none.** No mail is delivered on this domain. |
| TXT | **none.** No SPF, DKIM or verification records to preserve. |
| Shopify store | `b91p0j-f4.myshopify.com`, already password protected — every address 302s to `/password`. |

**Email is not at risk.** Company mail runs on the separate domain
`sabdia.com.au`, which sits on Telstra nameservers and delivers to
Microsoft 365. Nothing in this job touches it. That is the usual reason a
domain move goes wrong, and it does not apply here.

**The lock.** Whois shows `clientUpdateProhibited` on the domain. That is
GoDaddy's own lock and it has to come off before nameservers can change.
It is a toggle in the GoDaddy dashboard, not a support ticket.

**The GoDaddy login is Muhammad's.** The registrant contact is his name, so
the account that can change nameservers is most likely his rather than
Naomi's. Worth confirming before starting, because it is the one step that
cannot be worked around.

## The order of operations

Shopify has to know about the domain before DNS points at it, otherwise the
domain resolves to a store that will not answer for it.

### 1. Add the domain to Shopify (2 minutes, no public effect)

Shopify admin → **Settings → Domains → Connect existing domain** →
`sabdiaconstructions.com.au` → **Next**.

Shopify shows the two records it wants. They are always the same:

| Type | Name / Host | Points to |
|---|---|---|
| A | `@` (the root) | `23.227.38.65` |
| CNAME | `www` | `shops.myshopify.com` |

Leave the page open. Nothing has changed publicly yet: the Wix site is
still live because DNS still points at Wix.

*Prerequisite:* a custom domain needs the store on a paid plan, not a
trial. Settings → Plan will say.

### 2. Point DNS at Shopify (this is the moment the Wix site goes dark)

Two ways. **Take route A.**

**Route A — move DNS back to GoDaddy (recommended).** The domain is
registered there, so this puts the registration and the DNS in one place
and takes Wix out of the picture entirely.

1. GoDaddy → **My Products → Domains →** `sabdiaconstructions.com.au` →
   **Domain Settings**.
2. If **Domain lock** is on, turn it off.
3. **Nameservers → Change → I'll use my own nameservers** is what is set
   now; switch it back to **GoDaddy nameservers (default)**. Save.
4. Wait for the change to take (usually minutes), then
   **DNS → Records** and add:
   - **A**, name `@`, value `23.227.38.65`, TTL 600
   - **CNAME**, name `www`, value `shops.myshopify.com`, TTL 600
   Delete any other A or CNAME record on `@` or `www` left over from Wix.
5. Turn **Domain lock** back on.

**Route B — leave the nameservers at Wix and edit the records there.**
Wix → **Domains →** the domain → **Advanced → Edit DNS records**, change the
A record on `@` to `23.227.38.65` and the `www` CNAME to
`shops.myshopify.com`. Fewer steps, but DNS stays somewhere the business is
trying to leave, and Wix has a habit of restoring its own records for a
domain still connected to a Wix site. If this route is taken, disconnect
the domain from the Wix site first.

### 3. Wait, then check

- Shopify's Domains page moves the domain to **Connected** on its own.
- HTTPS is issued automatically, usually inside an hour, occasionally up to
  48. Until it lands, the address may show a certificate warning. That is
  expected and needs nothing done to it.
- From a terminal:
  ```bash
  dig +short A sabdiaconstructions.com.au; dig +short CNAME www.sabdiaconstructions.com.au
  ```
  Expect `23.227.38.65` and `shops.myshopify.com.`

### 4. Set the primary domain

Settings → **Domains → ⋯ → Change primary domain** →
`www.sabdiaconstructions.com.au`. Shopify then redirects the bare domain
and the `.myshopify.com` address to it.

### 5. Nothing else to switch on

The store is already password protected, so the moment DNS resolves, the
public sees the coming-soon page. There is no separate setting to close the
site. To check it is on: Online Store → **Preferences → Restrict access**.

To let someone in (Tamsin, an agent, Muhammad), give them the store
password from that same screen. Anyone logged into the Shopify admin skips
it entirely.

## Going fully live, later

Online Store → **Preferences → Restrict access** → off. That single toggle
turns the coming-soon page into the site. Everything else in
`LAUNCH-CHECKLIST.md` from item 18 down still applies.

## If it needs undoing

Do not cancel the Wix subscription until the new site has been live and
watched for a week. To go back, point the records at Wix again:

- A on `@` → `185.230.63.171` (Wix also answers on `185.230.63.107` and
  `185.230.63.186`)
- CNAME on `www` → `cdn3.wixdns.net`

or set the nameservers back to `ns6.wixdns.net` / `ns7.wixdns.net`, which
restores everything Wix was serving in one move. With a 600 second TTL the
change is visible in minutes.

## One thing worth weighing first

While the domain serves a locked store, every address on it answers with a
redirect to the password page. Google will drop the old Wix pages from its
index for as long as that lasts. A week or two is nothing and recovers on
its own. Two months of a coming-soon page and the site launches with its
search history flattened, which for a name people search directly is a
nuisance rather than a disaster, but it is real.

If the closed window is going to be long, the alternative is to leave Wix
serving the domain until the Shopify site is genuinely ready, and do the
DNS move and the password removal on the same day.
