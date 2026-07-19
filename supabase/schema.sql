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
