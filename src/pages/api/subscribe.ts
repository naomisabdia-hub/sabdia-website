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
 * Newsletter signup.
 *
 * With MAILERLITE_API_KEY + MAILERLITE_GROUP_ID set, subscribers land in
 * the MailerLite group (ready for EDMs). Until those keys exist, every
 * signup is stored in Supabase `enquiries` as form_name 'newsletter' so
 * no address is ever lost — they can be imported into MailerLite later.
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

  const email = (fields['email'] ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return json({ error: 'A valid email address is required' }, 400);
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const recent = (rateLog.get(ip) ?? []).filter((t) => t > now - 60_000);
  if (recent.length >= 5) return json({ error: 'Too many attempts — please try again shortly' }, 429);
  recent.push(now);
  rateLog.set(ip, recent);
  if (rateLog.size > 1000) rateLog.clear();

  const mlKey = env('MAILERLITE_API_KEY');
  const mlGroup = env('MAILERLITE_GROUP_ID');

  if (mlKey && mlGroup) {
    const resp = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mlKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email, groups: [mlGroup] }),
    });
    // 200 = updated existing, 201 = created; both are a successful signup.
    if (resp.ok) return json({ ok: true });
    console.error('MailerLite error:', resp.status, await resp.text());
    // fall through to the Supabase fallback rather than losing the address
  }

  const supabaseUrl = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { error } = await supabase
      .from('enquiries')
      .insert({ form_name: 'newsletter', email, message: 'Newsletter signup (stored until MailerLite is connected)' });
    if (!error) return json({ ok: true });
    console.error('Failed to store newsletter signup:', error.message);
  }

  return json({ error: 'Signup could not be delivered — backend not configured' }, 500);
};
