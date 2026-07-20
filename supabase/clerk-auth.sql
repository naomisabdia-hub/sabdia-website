-- ============================================================
-- CLERK AUTH MIGRATION — run once in the Supabase SQL editor
-- (Dashboard → SQL Editor → paste → Run) when switching the
-- admin portal's sign-in to Clerk. See CLERK-SETUP.md.
--
-- Safe to run at any time: existing Supabase-auth sessions keep
-- working (members are matched by account id OR email), so this
-- can be applied before the Clerk keys go live.
--
-- Why it exists: Clerk user ids are not UUIDs, so any policy or
-- trigger that calls auth.uid() (which casts the JWT `sub` claim
-- to uuid) would crash on a Clerk token. Everything below reads
-- the claims as plain text instead.
-- ============================================================

-- ── Identity helpers (no uuid casts anywhere) ─────────────────
create or replace function jwt_sub() returns text
language sql stable as
$$ select coalesce(auth.jwt()->>'sub', '') $$;

create or replace function jwt_email() returns text
language sql stable as
$$
  select lower(coalesce(
    auth.jwt()->>'email',
    auth.jwt()->'user_metadata'->>'email',
    ''))
$$;

-- ── Portal membership checks ──────────────────────────────────
create or replace function is_admin_user()
returns boolean language sql stable security definer set search_path = public as
$$
  select exists (
    select 1 from admin_users
    where user_id::text = jwt_sub()
       or (jwt_email() <> '' and lower(email) = jwt_email())
  )
$$;

create or replace function is_portal_admin()
returns boolean language sql stable security definer set search_path = public as
$$
  select exists (
    select 1 from admin_users
    where role = 'admin'
      and (user_id::text = jwt_sub()
        or (jwt_email() <> '' and lower(email) = jwt_email()))
  )
$$;

-- ── admin_users: allow Clerk-only members (no Supabase account) ──
alter table admin_users drop constraint if exists admin_users_user_id_fkey;
alter table admin_users drop constraint if exists admin_users_pkey;
alter table admin_users alter column user_id drop not null;
create unique index if not exists admin_users_email_key on admin_users (lower(email));

-- Any signed-in token may read the member list (needed by the portal
-- to resolve the visitor's own role); avoids auth.uid()'s uuid cast.
drop policy if exists "Admins can read admin_users" on admin_users;
create policy "Admins can read admin_users" on admin_users
  for select using (auth.role() = 'authenticated');

-- Full admins can add, update, and remove team members from the portal.
drop policy if exists "Admins manage admin_users" on admin_users;
create policy "Admins manage admin_users" on admin_users
  for all using (is_portal_admin()) with check (is_portal_admin());

-- ── Audit log: record Clerk identities too ────────────────────
create or replace function log_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  key text;
begin
  key := coalesce(
    case when tg_op = 'DELETE' then null else
      coalesce(to_jsonb(new) ->> 'slug', to_jsonb(new) ->> 'key', to_jsonb(new) ->> 'id') end,
    to_jsonb(old) ->> 'slug', to_jsonb(old) ->> 'key', to_jsonb(old) ->> 'id');
  insert into audit_log (user_id, user_email, action, table_name, record_key, changed)
  values (
    case when jwt_sub() ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         then jwt_sub()::uuid else null end,
    coalesce(
      (select email from admin_users where user_id::text = jwt_sub()),
      nullif(jwt_email(), ''),
      'service role'),
    tg_op,
    tg_table_name,
    key,
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;
