import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

/**
 * Sends a reply to an enquiry from the admin inbox and logs it in the
 * `replies` table (see supabase/inbox-management.sql) so the thread is
 * visible against the lead.
 *
 * Auth: the signed-in portal user's bearer token, verified against
 * Supabase's is_admin_user() — same pattern as /api/ai.
 *
 * Sending requires RESEND_API_KEY and a CONTACT_FROM address on a
 * Resend-verified domain. Until sabdiaconstructions.com.au is verified
 * in Resend, replies would go out from the generic onboarding sender
 * and likely land in spam — so without CONTACT_FROM this endpoint
 * refuses rather than sending mail that damages deliverability.
 */

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const env = (key: string) => import.meta.env[key] ?? process.env[key];

async function adminEmail(request: Request): Promise<string | null> {
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  const url = env('SUPABASE_URL');
  const anon = env('SUPABASE_ANON_KEY') ?? env('PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !anon) return null;
  const resp = await fetch(`${url}/rest/v1/rpc/is_admin_user`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: auth, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!resp.ok || (await resp.json()) !== true) return null;
  /* Best-effort identity for the log — who pressed Send. */
  const who = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: auth },
  }).catch(() => null);
  if (who?.ok) {
    const u = await who.json();
    if (u?.email) return u.email;
  }
  return 'portal user';
}

export const POST: APIRoute = async ({ request }) => {
  const sender = await adminEmail(request);
  if (!sender) return json({ error: 'Sign in to the admin portal to send replies.' }, 401);

  const resendKey = env('RESEND_API_KEY');
  const from = env('CONTACT_FROM');
  if (!resendKey) return json({ error: 'Replies are not activated yet — add RESEND_API_KEY to the environment.' }, 503);
  if (!from) {
    return json({ error: 'Replies need CONTACT_FROM set to an address on a Resend-verified Sabdia domain (see HANDOVER.md §7) — otherwise mail goes out as onboarding@resend.dev and lands in spam.' }, 503);
  }

  const supabaseUrl = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Supabase is not configured on the server.' }, 503);

  const p = (await request.json().catch(() => ({}))) as Record<string, string>;
  const enquiryId = String(p.enquiryId ?? '');
  const subject = String(p.subject ?? '').trim().slice(0, 300);
  const body = String(p.body ?? '').trim().slice(0, 20000);
  if (!enquiryId || !subject || !body) return json({ error: 'Subject and message are both required.' }, 400);

  /* The recipient comes from the stored enquiry, never from the client —
     the inbox can only reply to the address that actually enquired. */
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: lead, error: leadErr } = await supabase
    .from('enquiries')
    .select('id, email, first_name, last_name')
    .eq('id', enquiryId)
    .maybeSingle();
  if (leadErr) return json({ error: leadErr.message }, 500);
  if (!lead?.email) return json({ error: 'This lead has no email address to reply to.' }, 400);

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [lead.email],
      subject,
      text: body,
      reply_to: env('CONTACT_EMAIL') || from,
    }),
  });
  if (!resp.ok) {
    console.error('Resend error:', resp.status, await resp.text());
    return json({ error: 'The email service rejected the reply — check the Resend dashboard.' }, 502);
  }

  const { error: logErr } = await supabase.from('replies').insert({
    enquiry_id: lead.id,
    to_email: lead.email,
    subject,
    body,
    sent_by: sender,
  });
  /* The mail is already gone; a logging failure (e.g. the replies table
     migration not yet run) must not read as "not sent". */
  if (logErr) console.error('Reply sent but not logged:', logErr.message);

  return json({ ok: true, logged: !logErr });
};
