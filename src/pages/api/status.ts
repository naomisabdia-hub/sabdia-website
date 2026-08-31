import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Configuration health for the admin portal — which optional services
 * are switched on, so Settings and the Leads Inbox can SHOW an owner
 * that (say) email alerts are off instead of failing silently.
 *
 * Reports booleans only, never values. Auth: the signed-in portal
 * user's bearer token, verified via is_admin_user() — same pattern as
 * /api/reply.
 */

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const env = (key: string) => import.meta.env[key] ?? process.env[key];

async function isAdmin(request: Request): Promise<boolean> {
  const auth = request.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return false;
  const url = env('SUPABASE_URL');
  const anon = env('SUPABASE_ANON_KEY') ?? env('PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !anon) return false;
  const resp = await fetch(`${url}/rest/v1/rpc/is_admin_user`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: auth, 'Content-Type': 'application/json' },
    body: '{}',
  });
  return resp.ok && (await resp.json()) === true;
}

export const GET: APIRoute = async ({ request }) => {
  if (!(await isAdmin(request))) return json({ error: 'Sign in to the admin portal first.' }, 401);
  return json({
    /* An enquiry email lands in the inbox the moment a form is sent. */
    emailAlerts: Boolean(env('RESEND_API_KEY') && env('CONTACT_EMAIL')),
    /* Replying from the Leads Inbox (needs a verified From address). */
    replySending: Boolean(env('RESEND_API_KEY') && env('CONTACT_FROM')),
    /* Visitor counting on the public site. */
    analytics: Boolean(env('PUBLIC_GA4_ID')),
  });
};
