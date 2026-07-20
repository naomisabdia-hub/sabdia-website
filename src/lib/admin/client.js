/**
 * Admin portal browser runtime: Supabase client, auth guard, toasts,
 * uploads, and small DOM helpers. Imported by /admin pages' scripts;
 * bundled by Astro, runs only in the browser.
 *
 * Sign-in runs in one of two modes:
 *  - Clerk mode  — active when PUBLIC_CLERK_PUBLISHABLE_KEY is set.
 *    Clerk handles the sign-in UI/session; Supabase accepts the Clerk
 *    token via its third-party-auth integration (see CLERK-SETUP.md),
 *    and row-level security matches portal users by email.
 *  - Supabase mode — the original email/password + magic-link flow.
 *    Used automatically whenever the Clerk key is absent.
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const clerkKey = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY;

export const configured = Boolean(url && anonKey);
export const clerkMode = Boolean(clerkKey);

let clerkInstance = null;
/**
 * Lazily load + initialise ClerkJS (Clerk mode only); cached.
 * Hot-loads the official browser build from the instance's own Clerk
 * domain (derived from the publishable key) — the self-bundled npm build
 * ships without the sign-in UI components ("Clerk was not loaded with UI
 * components"), the hosted build always has them.
 */
export async function getClerk() {
  if (!clerkMode) return null;
  if (!clerkInstance) {
    if (!window.Clerk) {
      const domain = atob(clerkKey.split('_')[2]).replace(/\$$/, '');
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = `https://${domain}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`;
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.setAttribute('data-clerk-publishable-key', clerkKey);
        s.onload = resolve;
        s.onerror = () => reject(new Error('Failed to load Clerk'));
        document.head.appendChild(s);
      });
    }
    clerkInstance = window.Clerk;
    await clerkInstance.load();
  }
  return clerkInstance;
}

export const supabase = configured
  ? createClient(
      url,
      anonKey,
      clerkMode
        ? { accessToken: async () => (await getClerk())?.session?.getToken() ?? null }
        : undefined,
    )
  : null;

/** The signed-in portal user's bearer token (Clerk or Supabase mode). */
export async function accessToken() {
  if (clerkMode) return (await getClerk())?.session?.getToken() ?? null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

const toLogin = (query) => {
  location.href = '/admin/login/' + query;
};

/** Redirect to login unless a signed-in portal user; returns { user, role }. */
export async function requireAuth() {
  if (!configured) {
    document.body.innerHTML =
      '<div class="ad-empty" style="padding-top:120px">Supabase is not configured — add PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY.</div>';
    throw new Error('unconfigured');
  }

  let email, user, signOut;
  if (clerkMode) {
    const clerk = await getClerk();
    if (!clerk.user) {
      toLogin('?next=' + encodeURIComponent(location.pathname));
      throw new Error('unauthenticated');
    }
    user = clerk.user;
    email = clerk.user.primaryEmailAddress?.emailAddress ?? '';
    signOut = () => clerk.signOut();
  } else {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toLogin('?next=' + encodeURIComponent(location.pathname));
      throw new Error('unauthenticated');
    }
    user = session.user;
    email = session.user.email ?? '';
    signOut = () => supabase.auth.signOut();
  }

  // Portal membership — matched by account id (Supabase) or email (Clerk).
  const query = clerkMode
    ? supabase.from('admin_users').select('role, email').ilike('email', email)
    : supabase.from('admin_users').select('role, email').eq('user_id', user.id);
  const { data: row } = await query.maybeSingle();
  if (!row) {
    await signOut();
    toLogin('?denied=1');
    throw new Error('not an admin user');
  }

  const el = document.getElementById('adUser');
  if (el) el.textContent = row.email;
  const btn = document.getElementById('adLogout');
  if (btn)
    btn.addEventListener('click', async () => {
      await signOut();
      toLogin('');
    });
  return { user, role: row.role };
}

let toastTimer;
export function toast(msg, isError = false) {
  let el = document.querySelector('.ad-toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'ad-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.toggle('err', isError);
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/** Upload a file to the public media bucket; returns its public URL. */
export async function uploadFile(file, folder = 'uploads') {
  const MAX_MB = 25;
  if (file.size > MAX_MB * 1024 * 1024) {
    throw new Error(`File is ${(file.size / 1048576).toFixed(1)}MB — the limit is ${MAX_MB}MB. Please resize it first.`);
  }
  const clean = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-');
  const path = `${folder}/${Date.now()}-${clean}`;
  const { error } = await supabase.storage.from('media').upload(path, file, { upsert: false });
  if (error) throw error;
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== false) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) if (c) node.appendChild(c);
  return node;
}

export function csvExport(rows, filename) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function fmtDate(iso) {
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}
