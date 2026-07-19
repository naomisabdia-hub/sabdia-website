import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const env = (key: string) => import.meta.env[key] ?? process.env[key];

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

  const record = {
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

  let stored = false;

  const supabaseUrl = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { error } = await supabase.from('enquiries').insert(record);
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
    const lines = Object.entries(record)
      .filter(([, value]) => value)
      .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${value}`);
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
