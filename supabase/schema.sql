-- Sabdia Constructions — database schema
-- Run this in the Supabase SQL Editor (then run seed.sql to load the
-- current six properties).

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  display_order int not null default 100,
  status text not null default 'for-sale' check (status in ('for-sale', 'sold')),
  suburb text not null,
  state text not null default 'Queensland',
  year int,
  beds int,
  baths int,
  cars int,
  land int,
  land_over boolean not null default false,
  image text not null,
  focus text not null default '',
  headline text not null,
  seo_description text not null default '',
  features jsonb not null default '[]',
  gallery jsonb not null default '[]',
  enquiry_heading text not null default '',
  enquiry_text text not null default '',
  enquiry_button text not null default 'Submit Enquiry',
  description text not null default '',
  viewer_type text not null default 'none' check (viewer_type in ('none', 'model', 'tour')),
  model_url text not null default '',
  poster_url text not null default '',
  tour_url text not null default '',
  hotspots jsonb not null default '[]',
  brochure_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Columns added after the original launch (no-ops on a fresh database)
alter table properties add column if not exists viewer_type text not null default 'none';
alter table properties add column if not exists model_url text not null default '';
alter table properties add column if not exists poster_url text not null default '';
alter table properties add column if not exists tour_url text not null default '';
alter table properties add column if not exists hotspots jsonb not null default '[]';
alter table properties add column if not exists brochure_url text not null default '';

-- Anyone may read properties (the public website needs them);
-- writing requires the service role or the Supabase dashboard.
alter table properties enable row level security;
drop policy if exists "Public read access" on properties;
create policy "Public read access" on properties for select using (true);

create table if not exists enquiries (
  id uuid primary key default gen_random_uuid(),
  form_name text,
  property text,
  first_name text,
  last_name text,
  email text,
  phone text,
  enquiry_type text,
  message text,
  agency text,
  licence_number text,
  suburb_markets text,
  created_at timestamptz not null default now()
);

-- No public policies: enquiries are written by the server (service role)
-- and read only in the Supabase dashboard.
alter table enquiries enable row level security;

-- ── Site content ──────────────────────────────────────────────
-- One jsonb document per editable section (hero, about, footer, nav,
-- global settings, …). The admin portal renders a friendly form per key;
-- the website falls back to src/lib/seed-content.json when a key is absent.
create table if not exists site_content (
  key text primary key,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table site_content enable row level security;
drop policy if exists "Public read access" on site_content;
create policy "Public read access" on site_content for select using (true);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  sort int not null default 100,
  number text not null default '',
  title text not null,
  description text not null default '',
  icon text not null default 'home',
  label text not null default '',
  detail jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table services add column if not exists label text not null default '';
alter table services add column if not exists detail jsonb not null default '{}';
alter table services enable row level security;
drop policy if exists "Public read access" on services;
create policy "Public read access" on services for select using (true);

create table if not exists process_steps (
  id uuid primary key default gen_random_uuid(),
  sort int not null default 100,
  title text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table process_steps enable row level security;
drop policy if exists "Public read access" on process_steps;
create policy "Public read access" on process_steps for select using (true);

create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  sort int not null default 100,
  quote text not null,
  attribution text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table testimonials enable row level security;
drop policy if exists "Public read access" on testimonials;
create policy "Public read access" on testimonials for select using (true);

-- ── Admin & security ──────────────────────────────────────────
-- Who may use the admin portal. A row here (keyed by auth.users id)
-- grants access; role 'admin' can manage users, 'editor' can edit content.
create table if not exists admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'editor' check (role in ('admin', 'editor')),
  created_at timestamptz not null default now()
);
alter table admin_users enable row level security;
drop policy if exists "Admins can read admin_users" on admin_users;
create policy "Admins can read admin_users" on admin_users
  for select using (auth.uid() is not null);

-- Helper: true when the current JWT belongs to an admin portal user.
create or replace function is_admin_user()
returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from admin_users where user_id = auth.uid()) $$;

-- Content write access for portal users (public read policies already exist).
drop policy if exists "Admin write access" on properties;
create policy "Admin write access" on properties
  for all using (is_admin_user()) with check (is_admin_user());
drop policy if exists "Admin write access" on site_content;
create policy "Admin write access" on site_content
  for all using (is_admin_user()) with check (is_admin_user());
drop policy if exists "Admin write access" on services;
create policy "Admin write access" on services
  for all using (is_admin_user()) with check (is_admin_user());
drop policy if exists "Admin write access" on process_steps;
create policy "Admin write access" on process_steps
  for all using (is_admin_user()) with check (is_admin_user());
drop policy if exists "Admin write access" on testimonials;
create policy "Admin write access" on testimonials
  for all using (is_admin_user()) with check (is_admin_user());

-- Leads inbox: portal users may read and update (status/notes), never delete.
alter table enquiries add column if not exists status text not null default 'new'
  check (status in ('new', 'contacted', 'closed'));
alter table enquiries add column if not exists notes text not null default '';
drop policy if exists "Admin read access" on enquiries;
create policy "Admin read access" on enquiries for select using (is_admin_user());
drop policy if exists "Admin update access" on enquiries;
create policy "Admin update access" on enquiries
  for update using (is_admin_user()) with check (is_admin_user());

-- Draft workflow: unpublished properties are hidden from the public site
-- but visible in the portal and via authenticated preview.
alter table properties add column if not exists published boolean not null default true;
drop policy if exists "Public read access" on properties;
create policy "Public read access" on properties
  for select using (published = true or is_admin_user());

-- ── Audit log ─────────────────────────────────────────────────
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  user_email text,
  action text not null,
  table_name text not null,
  record_key text,
  changed jsonb,
  created_at timestamptz not null default now()
);
alter table audit_log enable row level security;
drop policy if exists "Admin read access" on audit_log;
create policy "Admin read access" on audit_log for select using (is_admin_user());

-- Every insert/update/delete on content tables is recorded automatically.
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
    auth.uid(),
    coalesce((select email from admin_users where user_id = auth.uid()), 'service role'),
    tg_op,
    tg_table_name,
    key,
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['properties', 'site_content', 'services', 'process_steps', 'testimonials'] loop
    execute format('drop trigger if exists audit_%I on %I', t, t);
    execute format('create trigger audit_%I after insert or update or delete on %I for each row execute function log_audit()', t, t);
  end loop;
end $$;

-- updated_at maintenance
create or replace function touch_updated_at()
returns trigger language plpgsql as
$$ begin new.updated_at := now(); return new; end $$;
do $$
declare t text;
begin
  foreach t in array array['properties', 'site_content', 'services', 'process_steps', 'testimonials'] loop
    execute format('drop trigger if exists touch_%I on %I', t, t);
    execute format('create trigger touch_%I before update on %I for each row execute function touch_updated_at()', t, t);
  end loop;
end $$;

-- ── Storage ───────────────────────────────────────────────────
-- Public media bucket for property images, brochures, and 3D models.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;
drop policy if exists "Public read media" on storage.objects;
create policy "Public read media" on storage.objects
  for select using (bucket_id = 'media');
drop policy if exists "Admin write media" on storage.objects;
create policy "Admin write media" on storage.objects
  for all using (bucket_id = 'media' and is_admin_user())
  with check (bucket_id = 'media' and is_admin_user());
