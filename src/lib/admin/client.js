/**
 * Admin portal browser runtime: Supabase client, auth guard, toasts,
 * uploads, and small DOM helpers. Imported by /admin pages' scripts;
 * bundled by Astro, runs only in the browser.
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const configured = Boolean(url && anonKey);
export const supabase = configured ? createClient(url, anonKey) : null;

/** Redirect to login unless a signed-in portal user; returns { user, role }. */
export async function requireAuth() {
  if (!configured) {
    document.body.innerHTML =
      '<div class="ad-empty" style="padding-top:120px">Supabase is not configured — add PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY.</div>';
    throw new Error('unconfigured');
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.href = '/admin/login/?next=' + encodeURIComponent(location.pathname);
    throw new Error('unauthenticated');
  }
  const { data: row } = await supabase
    .from('admin_users')
    .select('role, email')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (!row) {
    await supabase.auth.signOut();
    location.href = '/admin/login/?denied=1';
    throw new Error('not an admin user');
  }
  const el = document.getElementById('adUser');
  if (el) el.textContent = row.email;
  const btn = document.getElementById('adLogout');
  if (btn)
    btn.addEventListener('click', async () => {
      await supabase.auth.signOut();
      location.href = '/admin/login/';
    });
  return { user: session.user, role: row.role };
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
