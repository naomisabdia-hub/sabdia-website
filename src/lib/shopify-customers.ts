/**
 * Every enquiry and newsletter signup is mirrored into Shopify › Customers,
 * so Shopify holds the person (tagged by residence, enquiry type and form)
 * and Marketing › Shopify Email can write to them later. Supabase, the
 * Leads Inbox, monday.com and the email alert all still happen; this is the
 * copy that lives where Naomi works.
 *
 * Needs SHOPIFY_STORE + SHOPIFY_ADMIN_TOKEN in the environment and the
 * custom app's `read_customers` + `write_customers` scopes. Without them it
 * logs one line and does nothing - a visitor never sees a failure here.
 */
const env = (key: string) => import.meta.env[key] ?? process.env[key];

export interface CustomerHandoff {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  tags: string[];
  /** One dated line describing this enquiry, prepended to the customer note. */
  noteLine?: string;
  /** true = subscribe to email marketing (newsletter form, or a ticked consent). */
  marketing?: boolean;
}

async function gql(query: string, variables: Record<string, unknown>) {
  const store = env('SHOPIFY_STORE');
  const token = env('SHOPIFY_ADMIN_TOKEN');
  if (!store || !token) return null;
  const resp = await fetch(`https://${store}/admin/api/2025-07/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const out = await resp.json().catch(() => ({}));
  if (!resp.ok || out.errors) {
    console.error('Shopify customers:', resp.status, JSON.stringify(out.errors ?? out).slice(0, 300));
    return null;
  }
  return out.data;
}

const clean = (s: string | null | undefined) => (s ?? '').toString().trim();

export async function upsertShopifyCustomer(h: CustomerHandoff): Promise<void> {
  const email = clean(h.email).toLowerCase();
  if (!email) return;
  const tags = Array.from(new Set(h.tags.map(clean).filter(Boolean)));
  const stamp = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', hour12: false });
  const line = h.noteLine ? `[${stamp}] ${h.noteLine}` : '';

  const found = await gql(
    `query($q: String!) { customers(first: 1, query: $q) { nodes { id tags note } } }`,
    { q: `email:"${email.replace(/"/g, '')}"` },
  );
  if (found === null) return;
  const existing = found.customers?.nodes?.[0];

  if (existing) {
    const mergedTags = Array.from(new Set([...(existing.tags ?? []), ...tags]));
    const note = [line, existing.note].filter(Boolean).join('\n').slice(0, 5000);
    const input: Record<string, unknown> = { id: existing.id, tags: mergedTags, note };
    if (clean(h.firstName)) input.firstName = clean(h.firstName);
    if (clean(h.lastName)) input.lastName = clean(h.lastName);
    const r = await gql(
      `mutation($input: CustomerInput!) { customerUpdate(input: $input) { userErrors { field message } } }`,
      { input },
    );
    if (r?.customerUpdate?.userErrors?.length) console.error('Shopify customerUpdate:', JSON.stringify(r.customerUpdate.userErrors));
    if (h.marketing) await setMarketing(existing.id);
    return;
  }

  const input: Record<string, unknown> = { email, tags, note: line || undefined };
  if (clean(h.firstName)) input.firstName = clean(h.firstName);
  if (clean(h.lastName)) input.lastName = clean(h.lastName);
  if (clean(h.phone)) input.phone = clean(h.phone);
  if (h.marketing) input.emailMarketingConsent = { marketingState: 'SUBSCRIBED', marketingOptInLevel: 'SINGLE_OPT_IN' };
  let r = await gql(
    `mutation($input: CustomerInput!) { customerCreate(input: $input) { customer { id } userErrors { field message } } }`,
    { input },
  );
  const errs = r?.customerCreate?.userErrors ?? [];
  if (errs.some((e: { field?: string[] }) => (e.field ?? []).includes('phone')) && input.phone) {
    /* Shopify insists on a valid E.164 phone - keep the person, drop the number
       (it is still in Supabase and the email alert). */
    delete input.phone;
    r = await gql(
      `mutation($input: CustomerInput!) { customerCreate(input: $input) { customer { id } userErrors { field message } } }`,
      { input },
    );
  }
  if (r?.customerCreate?.userErrors?.length) console.error('Shopify customerCreate:', JSON.stringify(r.customerCreate.userErrors));
}

async function setMarketing(id: string) {
  const r = await gql(
    `mutation($input: CustomerEmailMarketingConsentUpdateInput!) {
      customerEmailMarketingConsentUpdate(input: $input) { userErrors { field message } } }`,
    { input: { customerId: id, emailMarketingConsent: { marketingState: 'SUBSCRIBED', marketingOptInLevel: 'SINGLE_OPT_IN' } } },
  );
  if (r?.customerEmailMarketingConsentUpdate?.userErrors?.length) console.error('Shopify consent:', JSON.stringify(r.customerEmailMarketingConsentUpdate.userErrors));
}

/** Tag set for an enquiry record: website · form:<name> · residence:<X> · type:<Y>. */
export function enquiryTags(record: Record<string, unknown>): string[] {
  const t = ['website'];
  if (record.form_name) t.push(`form:${record.form_name}`);
  if (record.property) t.push(`residence:${String(record.property).toUpperCase()}`);
  if (record.enquiry_type) t.push(`type:${record.enquiry_type}`);
  if (record.agency) t.push('agent');
  return t;
}
