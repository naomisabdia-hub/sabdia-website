import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const env = (key: string) => import.meta.env[key] ?? process.env[key];

/** ip → recent submission timestamps, for the per-instance rate limit. */
const rateLog = new Map<string, number[]>();

/**
 * Receives form submissions (contact, property enquiry, agent application),
 * stores them in the Supabase `enquiries` table, and optionally emails a
 * copy via Resend when RESEND_API_KEY / CONTACT_EMAIL are configured.
 */
export const POST: APIRoute = async ({ request }) => {
  let fields: Record<string, string> = {};
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    fields = await request.json();
  } else {
    const formData = await request.formData();
    formData.forEach((value, key) => {
      fields[key] = String(value);
    });
  }

  // Honeypot: pretend success so bots don't retry
  if (fields['bot-field']) return json({ ok: true });

  /* Server-side validation — the client marks fields required, but the
     endpoint must not accept an empty or unaddressable record. */
  const email = (fields['email'] ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return json({ error: 'A valid email address is required' }, 400);
  }
  const substance = ['first-name', 'last-name', 'message', 'phone', 'agency'].some(
    (k) => (fields[k] ?? '').trim().length > 0,
  );
  if (!substance) return json({ error: 'Please tell us a little about your enquiry' }, 400);
  for (const k of Object.keys(fields)) fields[k] = String(fields[k]).slice(0, 5000);

  /* Light per-instance rate limit — a bot that beats the honeypot still
     can't flood the table from one address. (Serverless instances each
     keep their own window; that's fine for abuse-dampening.) */
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const windowStart = now - 60_000;
  const recent = (rateLog.get(ip) ?? []).filter((t) => t > windowStart);
  if (recent.length >= 5) return json({ error: 'Too many submissions — please try again shortly' }, 429);
  recent.push(now);
  rateLog.set(ip, recent);
  if (rateLog.size > 1000) rateLog.clear();

  const MAPPED = ['form-name', 'property', 'first-name', 'last-name', 'email', 'phone', 'enquiry-type', 'message', 'agency', 'licence-number', 'suburb-markets', 'bot-field'];
  const record: Record<string, unknown> = {
    form_name: fields['form-name'] || 'contact',
    property: fields['property'] || null,
    first_name: fields['first-name'] || null,
    last_name: fields['last-name'] || null,
    email: fields['email'] || null,
    phone: fields['phone'] || null,
    enquiry_type: fields['enquiry-type'] || null,
    message: fields['message'] || null,
    agency: fields['agency'] || null,
    licence_number: fields['licence-number'] || null,
    suburb_markets: fields['suburb-markets'] || null,
  };

  /* Catch-all: every other field the visitor filled in (e.g. the guided
     match's "anything else we should know", or any field added to a form
     later) is kept verbatim — nothing a visitor types is ever dropped. */
  const details: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!MAPPED.includes(key) && String(value).trim()) details[key] = String(value);
  }
  if (Object.keys(details).length) record.details = details;

  let stored = false;

  const supabaseUrl = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey);
    let { error } = await supabase.from('enquiries').insert(record);
    if (error && record.details && /details/.test(error.message)) {
      /* The details column migration hasn't been run yet — never lose the
         data: fold the extra answers into the message text instead. */
      const extras = Object.entries(record.details as Record<string, string>)
        .map(([k, v]) => `${k.replace(/-/g, ' ')}: ${v}`)
        .join('\n');
      const fallback = { ...record, details: undefined, message: [record.message, '—', extras].filter(Boolean).join('\n') };
      delete fallback.details;
      ({ error } = await supabase.from('enquiries').insert(fallback));
    }
    if (error) {
      console.error('Failed to store enquiry:', error.message);
    } else {
      stored = true;
    }
  }

  let emailed = false;

  const resendKey = env('RESEND_API_KEY');
  const contactEmail = env('CONTACT_EMAIL');
  if (resendKey && contactEmail) {
    const lines = Object.entries({ ...record, details: undefined, ...details })
      .filter(([, value]) => value)
      .map(([key, value]) => `${key.replace(/[_-]/g, ' ')}: ${value}`);
    const subject = ['Website enquiry', record.form_name, record.property]
      .filter(Boolean)
      .join(' — ');
    const payload: Record<string, unknown> = {
      from: env('CONTACT_FROM') || 'Sabdia Website <onboarding@resend.dev>',
      to: [contactEmail],
      subject,
      text: lines.join('\n'),
    };
    if (record.email) payload.reply_to = record.email;

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      emailed = true;
    } else {
      console.error('Resend error:', resp.status, await resp.text());
    }
  }

  if (!stored && !emailed) {
    return json({ error: 'Enquiry could not be delivered — form backend not configured' }, 500);
  }
  return json({ ok: true });
};
