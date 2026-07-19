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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
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
