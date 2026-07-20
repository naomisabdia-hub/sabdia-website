-- SABDIA WEBSITE — one-shot database setup (safe to re-run)
-- 1) Renames the old experimental tables to legacy_* (nothing deleted)
-- 2) Creates the full current schema + security policies
-- 3) Loads all content
-- 4) Grants admin portal access to Naomi (run AFTER creating the auth user)

alter table if exists stats rename to legacy_stats;
alter table if exists seo_pages rename to legacy_seo_pages;
alter table if exists site_settings rename to legacy_site_settings;
do $$ begin if exists (select 1 from information_schema.columns where table_name='properties' and column_name='bedrooms') then alter table properties rename to legacy_properties; end if; end $$;
do $$ begin if not exists (select 1 from information_schema.columns where table_name='services' and column_name='sort' and table_schema='public') and exists (select 1 from pg_tables where tablename='services' and schemaname='public') then alter table services rename to legacy_services; end if; end $$;
do $$ begin if not exists (select 1 from information_schema.columns where table_name='testimonials' and column_name='sort' and table_schema='public') and exists (select 1 from pg_tables where tablename='testimonials' and schemaname='public') then alter table testimonials rename to legacy_testimonials; end if; end $$;

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

-- Seed data for the properties table (generated by scripts/properties-to-seed.mjs)
insert into properties (slug, name, display_order, status, suburb, state, year, beds, baths, cars, land, land_over, image, focus, headline, seo_description, features, gallery, enquiry_heading, enquiry_text, enquiry_button, viewer_type, model_url, poster_url, tour_url, hotspots, brochure_url, description)
values
  ('qasr', 'QASR', 1, 'for-sale', 'Coorparoo', 'Queensland', 2025, 5, 7, 9, 1000, true, '/images/qasr-hero.jpg', '', 'A palace for<br><em>the extraordinary life</em>.', 'QASR by Sabdia Constructions — a masterwork of contemporary residential architecture in Coorparoo, Queensland. Five bedrooms, seven bathrooms, nine-car garage.', '["Home Cinema","Resort Pool & Spa","Nine-Car Garage","Private Wine Cellar","Master Suite with Dressing Room","Chef''s Kitchen","Outdoor Entertaining Pavilion","Smart Home Automation","Lift Access","Gym & Wellness Studio","Study / Home Office","Multiple Living Zones"]'::jsonb, '[{"src":"/images/qasr-hero.jpg","alt":"QASR"},{"src":"/images/home-hero-1.jpg","alt":"QASR Interior"},{"src":"/images/home-hero-2.jpg","alt":"QASR Living"},{"src":"/images/qasr-hero.jpg","alt":"QASR Detail"},{"src":"/images/qasr-hero.jpg","alt":"QASR Exterior"},{"src":"/images/qasr-hero.jpg","alt":"QASR Pool"}]'::jsonb, 'Enquire About QASR', 'Register your interest or arrange a private inspection. Our team will be in touch within one business day.', 'Submit Enquiry', 'model', '/models/placeholder-home.glb', '/images/home-hero-1.jpg', '', '[]'::jsonb, '', 'QASR is Sabdia''s most ambitious and extraordinary achievement. A masterwork of contemporary residential architecture positioned in one of Coorparoo''s most coveted streets, QASR redefines what is possible in Brisbane luxury living. Every element of this extraordinary residence has been considered with an obsessive eye for detail — from the sweeping open-plan living and dining zones bathed in natural light, to the nine-car garage that rivals the finest private automotive collections.

The name QASR, derived from the Arabic for ''palace'', is a fitting moniker for a home of this magnitude. Its commanding street presence is merely the prologue to an interior of breathtaking scale and sophistication — spaces that have been composed with the precision of a master architect and the warmth of a consummate host. Natural stone, hand-selected timbers, and bespoke joinery converge to create an environment of singular beauty.

Five bedrooms, including a master suite of breathtaking proportion, seven bathrooms, a resort-style pool and entertaining pavilion, a private cinema, and a wine cellar combine to create a residence without equal in Brisbane. This is not simply a home — it is a declaration of what is possible when vision, craftsmanship, and ambition are brought together without compromise.'),
  ('solace', 'SOLACE', 2, 'for-sale', 'Camp Hill', 'Queensland', 2025, 5, 5, 4, 632, false, '/images/solace-hero.jpg', 'fp_0.5_0.65', 'Where calm<br><em>becomes architecture</em>.', 'SOLACE by Sabdia Constructions — an exercise in architectural restraint and material refinement. A five-bedroom luxury family home in Camp Hill, Queensland.', '["North-Facing Pool & Terrace","Four-Car Garage","Chef''s Kitchen with Butler''s Pantry","Master Suite with Walk-In Robe","Open Plan Living & Dining","Multiple Alfresco Areas","Smart Home System","Solar & Battery System","Study / Home Office","Media Room","Laundry with Ample Storage","Landscaped Gardens"]'::jsonb, '[{"src":"/images/solace-hero.jpg","alt":"SOLACE"},{"src":"/images/home-hero-1.jpg","alt":"SOLACE Interior"},{"src":"/images/home-hero-2.jpg","alt":"SOLACE Living"},{"src":"/images/solace-hero.jpg","alt":"SOLACE Detail"},{"src":"/images/solace-hero.jpg","alt":"SOLACE Terrace"},{"src":"/images/solace-hero.jpg","alt":"SOLACE Pool"}]'::jsonb, 'Enquire About SOLACE', 'Register your interest or arrange a private inspection. Our team will be in touch within one business day.', 'Submit Enquiry', 'none', '', '', '', '[]'::jsonb, '', 'SOLACE is an exercise in architectural restraint and material refinement. Positioned in a quiet, tree-lined street of Camp Hill, this five-bedroom family home embodies the Sabdia philosophy of creating homes that are simultaneously beautiful and deeply liveable. The name SOLACE speaks to the feeling evoked by the home itself — a profound sense of calm and well-being that settles over you the moment you cross the threshold.

Conceived as a sanctuary from the outside world, SOLACE features flowing open-plan living spaces that open to a north-facing terrace and resort-style pool — a seamless extension of the interior that makes the most of the Queensland climate in every season. Light moves through the home throughout the day, animated by a considered palette of natural stone, warm timber, and floor-to-ceiling glass that frames the garden beyond.

A kitchen of extraordinary quality anchors the heart of the home, while bedrooms designed to provide genuine refuge ensure that every member of the household has space to withdraw and restore. The four-car garage and generous storage throughout ensure that this home accommodates the demands of family life without compromise to its beauty.'),
  ('sierra', 'SIERRA', 3, 'for-sale', 'Holland Park West', 'Queensland', 2025, 5, 5, 3, 573, false, '/images/sierra-hero.jpg', 'fp_0.5_0.65', 'Architecture born<br><em>from the landscape</em>.', 'SIERRA by Sabdia Constructions — bold architecture commanding sweeping views across the Brisbane skyline. A five-bedroom luxury residence in Holland Park West, Queensland.', '["Sweeping City Views","Elevated Terrace & Dining","Resort Pool","Three-Car Garage","Chef''s Kitchen","Master Suite with Spa Ensuite","Multiple Living Zones","Home Office","Smart Home Integration","Architectural Joinery Throughout","Floor-to-Ceiling Glass","Natural Stone & Timber Palette"]'::jsonb, '[{"src":"/images/sierra-hero.jpg","alt":"SIERRA"},{"src":"/images/home-hero-1.jpg","alt":"SIERRA Interior"},{"src":"/images/home-hero-2.jpg","alt":"SIERRA Living"},{"src":"/images/sierra-hero.jpg","alt":"SIERRA Detail"},{"src":"/images/sierra-hero.jpg","alt":"SIERRA Terrace"},{"src":"/images/sierra-hero.jpg","alt":"SIERRA Pool"}]'::jsonb, 'Enquire About SIERRA', 'Register your interest or arrange a private inspection. Our team will be in touch within one business day.', 'Submit Enquiry', 'none', '', '', '', '[]'::jsonb, '', 'SIERRA draws its inspiration from the landscape itself — a considered response to the elevated site in Holland Park West that commands sweeping views across the Brisbane skyline. The architecture is bold and confident: clean lines, generous volumes, and a material palette of natural stone, timber, and glass that ages gracefully with the seasons and anchors the home firmly to its terrain.

Five bedrooms, each thoughtfully positioned to capture light and outlook, are anchored by a master suite of exceptional luxury. The open-plan ground floor flows seamlessly to an elevated entertaining terrace where the views become the defining feature of every meal and gathering — a living backdrop that shifts with the light from morning gold to the city''s evening glow.

The resort pool occupies a prime position on the entertaining level, set against the panorama in a way that blurs the boundary between built form and open sky. Inside, the kitchen is a chef''s environment of the highest specification, appointed with professional-grade appliances and generous stone surfaces that make it as pleasurable to cook in as it is to admire.'),
  ('caspian', 'CASPIAN', 4, 'for-sale', 'Ascot', 'Queensland', 2025, 5, 5, 3, 544, false, '/images/caspian-hero.jpg', 'fp_0.5_0.65', 'Grace, proportion,<br><em>and quiet grandeur</em>.', 'CASPIAN by Sabdia Constructions — a residence of exceptional grace and proportion in one of Ascot''s most prestigious addresses. Five bedrooms, resort pool, chef''s kitchen.', '["Prime Ascot Address","Resort Pool & Cabana","Chef''s Kitchen with Stone Benchtops","Marble Bathroom Finishes","Three-Car Garage","Master Suite Retreat","Open Plan Living","Alfresco Entertaining","Smart Home Automation","Private Courtyard Garden","Study / Library","Bespoke Joinery Throughout"]'::jsonb, '[{"src":"/images/caspian-hero.jpg","alt":"CASPIAN"},{"src":"/images/home-hero-1.jpg","alt":"CASPIAN Interior"},{"src":"/images/home-hero-2.jpg","alt":"CASPIAN Living"},{"src":"/images/caspian-hero.jpg","alt":"CASPIAN Detail"},{"src":"/images/caspian-hero.jpg","alt":"CASPIAN Exterior"},{"src":"/images/caspian-hero.jpg","alt":"CASPIAN Pool"}]'::jsonb, 'Enquire About CASPIAN', 'Register your interest or arrange a private inspection. Our team will be in touch within one business day.', 'Submit Enquiry', 'none', '', '', '', '[]'::jsonb, '', 'Positioned in one of Ascot''s most prestigious addresses, CASPIAN is a residence of exceptional grace and proportion. Named for the world''s largest enclosed body of water, CASPIAN evokes a sense of vast, tranquil space — an impression delivered immediately upon entering the home''s generous foyer, where ceiling heights and natural materials create an atmosphere of calm grandeur that sets the tone for every room beyond.

The interior architecture is characterised by a sophisticated restraint — each space pared back to its essential elements, allowing the quality of materials and craftsmanship to speak without distraction. Marble surfaces, hand-selected stone, and bespoke joinery are deployed with precision, creating an environment that feels simultaneously curated and entirely welcoming.

Five bedrooms, a resort-style pool with cabana, and a kitchen of extraordinary specification combine to create a home that is both a statement of taste and a joy to inhabit daily. The private courtyard garden and alfresco entertaining zones bring the outside in, creating a complete luxury lifestyle in the heart of one of Brisbane''s finest suburbs.'),
  ('capri', 'CAPRI', 5, 'sold', 'Inner Brisbane', 'Queensland', 2024, 5, 5, 3, 545, false, '/images/capri-hero.jpg', '', 'A residence that defined<br><em>a suburb''s standard</em>.', 'CAPRI by Sabdia Constructions — sold prior to completion. A 5-bedroom luxury residence delivering resort-style living in inner Brisbane.', '["Resort-Style Pool","Three-Car Garage","Chef''s Kitchen","Master Suite Retreat","Open Plan Living","Alfresco Entertaining","5 Bedrooms, 5 Bathrooms","Smart Home Automation","Architectural Joinery","Premium Stone Finishes","Study / Home Office","Landscape Gardens"]'::jsonb, '[{"src":"/images/capri-hero.jpg","alt":"CAPRI"},{"src":"/images/home-hero-1.jpg","alt":"CAPRI detail"},{"src":"/images/home-hero-2.jpg","alt":"CAPRI interior"},{"src":"/images/capri-hero.jpg","alt":"CAPRI exterior"},{"src":"/images/solace-hero.jpg","alt":"CAPRI pool"},{"src":"/images/sierra-hero.jpg","alt":"CAPRI kitchen"}]'::jsonb, 'Register Interest in Future Releases', 'CAPRI has been sold. If you''d like to be the first to know about upcoming Sabdia developments, register your interest below.', 'Register Interest', 'none', '', '', '', '[]'::jsonb, '', 'CAPRI was one of those rare residences that sets the standard for an entire neighbourhood. Sold prior to its completion — a testament to the confidence discerning buyers place in the Sabdia name — CAPRI demonstrated that luxury, livability, and craftsmanship could coexist in perfect harmony.

The home''s architecture was a masterclass in contemporary Queensland living: generous open-plan spaces that flowed effortlessly to covered outdoor entertaining areas, a resort-style pool, and a kitchen of exceptional specification. Five bedrooms, each with carefully considered natural light, were anchored by a master suite of genuine grandeur.

The success of CAPRI — sold before a single buyer had the opportunity to inspect in person — reflects the trust that the market places in Sabdia''s vision, quality, and track record. It also speaks to the extraordinary demand for truly exceptional luxury residences in inner Brisbane.'),
  ('aether', 'AETHER', 6, 'sold', 'Hendra', 'Queensland', 2024, 5, 5, 3, 572, false, '/images/aether-hero.jpg', '', 'Light, air, and<br><em>elevated living</em>.', 'AETHER by Sabdia Constructions — sold prior to completion. A luxury 5-bedroom residence in Hendra, inner Brisbane.', '["Resort Pool & Terrace","Three-Car Garage","Chef''s Kitchen","Master Suite with Spa Bath","5 Bedrooms, 5 Bathrooms","Open Plan Living","Indoor-Outdoor Flow","Smart Home Technology","Premium Stone Finishes","Custom Joinery Throughout","Study / Home Office","Landscaped Gardens"]'::jsonb, '[{"src":"/images/aether-hero.jpg","alt":"AETHER"},{"src":"/images/home-hero-1.jpg","alt":"AETHER"},{"src":"/images/home-hero-2.jpg","alt":"AETHER"},{"src":"/images/aether-hero.jpg","alt":"AETHER"},{"src":"/images/solace-hero.jpg","alt":"AETHER"},{"src":"/images/sierra-hero.jpg","alt":"AETHER"}]'::jsonb, 'Register for Future Releases', 'AETHER has been sold. Register your details to receive priority notification of upcoming Sabdia developments before they reach the market.', 'Register Interest', 'none', '', '', '', '[]'::jsonb, '', 'AETHER — named for the luminous upper atmosphere that exists above the clouds — was conceived as a study in light. Every architectural decision, from the orientation of the home to the selection of its materials, was made in service of one overriding goal: to fill each space with the quality of natural light that transforms a house into a home.

Positioned in Hendra, one of Brisbane''s most enviable inner-north suburbs, AETHER was sold prior to completion — purchased by a buyer whose confidence in Sabdia''s vision required no inspection. This is perhaps the greatest endorsement a developer can receive: trust in the name alone.

The five-bedroom residence featured a master suite of exceptional proportion, a kitchen designed for both serious cooking and relaxed entertaining, and indoor-outdoor living spaces that made the most of the Queensland climate. A resort-style pool, three-car garage, and meticulous attention to every detail from joinery to landscaping completed the picture of a home truly worthy of the Sabdia name.')
on conflict (slug) do nothing;

-- Seed data for site content (generated by scripts/content-to-seed.mjs)

insert into site_content (key, data)
values
  ('settings', '{"siteName":"Sabdia Constructions","legalName":"Sabdia Constructions Pty Ltd","estYear":2013,"logo":"/images/logo.png","logoLarge":"/images/logo.png","location":"Brisbane, Queensland, Australia","email":"sales@sabdia.com.au","phone":"","domainDisplay":"sabdiaconstructions.com.au","domainUrl":"https://www.sabdiaconstructions.com.au","socials":{"instagram":{"label":"@_sabdia","url":"https://www.instagram.com/_sabdia/"},"facebook":{"label":"Sabdia Constructions","url":"https://www.facebook.com/sabdiaconstructions/"},"linkedin":{"label":"Sabdia Constructions","url":"https://www.linkedin.com/company/sabdia-constructions/"}},"seo":{"title":"Sabdia Constructions | Luxury Home Builders & Developers, Brisbane","description":"Boutique luxury home builder and developer in inner Brisbane. Multi-award winning, 100+ residences delivered since 2013. Design, Develop, Construct.","ogTitle":"Sabdia Constructions — Luxury Home Builders, Brisbane","ogDescription":"Boutique luxury home builder and developer in inner Brisbane. Multi-award winning, 100+ residences delivered since 2013.","ogImage":"/images/home-hero-1.jpg"},"jsonLdImage":"/images/home-hero-1.jpg","jsonLdDescription":"Boutique luxury home builder and developer in inner Brisbane. Multi-award winning, 100+ residences delivered since 2013.","areaServed":"Brisbane, Queensland, Australia"}'::jsonb),
  ('nav', '{"items":[{"label":"For Sale","href":"/properties/"},{"label":"Services","href":"/services/"},{"label":"About","href":"/about/"},{"label":"Projects","href":"/projects/"},{"label":"Collection","href":"/collection/"},{"label":"Agent Access","href":"/agent-access/"}],"mobileItems":[{"label":"For Sale","href":"/properties/"},{"label":"Services","href":"/services/"},{"label":"About","href":"/about/"},{"label":"Projects","href":"/projects/"},{"label":"Collection","href":"/collection/"},{"label":"Agent Access","href":"/agent-access/"},{"label":"Contact","href":"/contact/"}],"cta":{"label":"Enquire","href":"/contact/"},"loaderMeta":"Sabdia · Est. 2013"}'::jsonb),
  ('footer', '{"taglineHtml":"Design. <em>Develop.</em><br>Construct.","taglineSub":"Boutique luxury home builder & developer delivering award-winning residences across inner Brisbane since 2013.","blurbHtml":"Boutique Luxury Home Builder &<br>Developer — Brisbane, QLD","companyLinks":[{"label":"About Sabdia","href":"/about/"},{"label":"Services","href":"/services/"},{"label":"Projects","href":"/projects/"},{"label":"Collection","href":"/collection/"},{"label":"Agent Access","href":"/agent-access/"}],"legalLinks":[{"label":"Accessibility","href":"/accessibility/"},{"label":"Privacy","href":"/privacy/"}]}'::jsonb),
  ('home_hero', '{"words":["Design","Develop","Construct"],"eyebrow":"Boutique Luxury Home Builder & Developer — Brisbane","description":"Redefining luxury through design, detail, and craftsmanship. For over ten years, Sabdia has delivered award-winning residences that set a new benchmark for contemporary living in Brisbane.","award":"Award-Winning Luxury Residences.","slides":[{"image":"/images/home-hero-1.jpg","alt":"Sabdia luxury home"},{"image":"/images/home-hero-2.jpg","alt":"Sabdia luxury home"},{"image":"/images/solace-hero.jpg","alt":"Sabdia luxury home"}],"primaryCta":{"label":"View Properties","href":"/properties/"},"secondaryCta":{"label":"Begin a Conversation","href":"/contact/"}}'::jsonb),
  ('home_stats', '{"items":[{"target":10,"suffix":"+","label":"Years in Brisbane","count":true},{"target":100,"suffix":"+","label":"Residences Delivered","count":true},{"target":5,"suffix":"★","label":"Multi-Award Winning","count":true},{"target":100,"suffix":"%","label":"In-House Delivery","count":false}]}'::jsonb),
  ('home_marquee', '{"items":["Multi-Award Winning","Design · Develop · Construct","Inner Brisbane Specialist","100+ Residences Since 2013","Boutique Luxury Developer"]}'::jsonb),
  ('home_about', '{"label":"About Sabdia","headingHtml":"Crafting <em>Exquisite</em><br>Living Spaces.","images":[{"image":"/images/home-hero-1.jpg","alt":"Sabdia craftsmanship"},{"image":"/images/home-hero-2.jpg","alt":"Sabdia detail"}],"paragraphs":["At Sabdia, we manage every step of the residential development journey in-house — from visionary design through to expert construction. This integrated approach allows us to maintain meticulous control over quality, timing, and innovation, delivering homes that stand the test of time.","With a focus on creating exceptional living spaces, Sabdia Constructions is dedicated to shaping the future of residential developments through innovation, quality, and unparalleled craftsmanship. Every project begins with a deep understanding of both the site and the clients who will call it home.","We are not merely builders — we are creators of legacy. Each residence we deliver is conceived as a singular work of architecture, thoughtfully designed to complement its surroundings and exceed every expectation of luxury living."],"sigName":"Sabdia","sigTitle":"Founder & Principal","values":[{"n":"i.","title":"Integrated Delivery","desc":"Design, develop, and construct under one roof — seamless from concept to keys."},{"n":"ii.","title":"Uncompromising Quality","desc":"Only the finest materials, master tradespeople, and meticulous attention to detail."},{"n":"iii.","title":"Boutique & Personal","desc":"Limited projects annually to ensure every client receives our full dedication."}],"cta":{"label":"Our Full Story","href":"/about/"}}'::jsonb),
  ('home_properties', '{"label":"For Sale","headingHtml":"<em>Current</em> Properties","cta":{"label":"View All","href":"/properties/"}}'::jsonb),
  ('home_services', '{"label":"What We Do","headingHtml":"Full-spectrum<br><em>development</em><br>expertise.","text":"From site acquisition through to final handover, Sabdia manages every element in-house — ensuring seamless delivery and uncompromising quality at every stage.","cta":{"label":"Explore Services","href":"/services/"}}'::jsonb),
  ('home_process', '{"label":"Our Process"}'::jsonb),
  ('home_agent', '{"label":"For Real Estate Professionals","headingHtml":"Exclusive <em>Agent</em><br>Access.","text":"Gain exclusive insight into Sabdia''s future releases. Our agent-only preview list offers early access to premium developments, pre-launch information, and priority communication — giving your clients an edge in Brisbane''s luxury market.","badge":"Exclusive Access","image":{"image":"/images/agent-portrait.jpg","alt":"Agent Access"},"features":["Pre-release access to upcoming developments","Pre-launch pricing and floor plan information","Priority communication on new releases","Exclusive commission structures","Invitations to private project previews","Dedicated liaison with the Sabdia team"],"primaryCta":{"label":"Apply for Access","href":"/agent-access/"},"secondaryCta":{"label":"Learn More","href":"/contact/"}}'::jsonb),
  ('home_contact', '{"label":"Get In Touch","headingHtml":"Let''s start<br>a <em>conversation</em>.","text":"Please submit your contact information and one of our team members will be in touch with you shortly.","interests":["For Sale — Current Properties","Custom Home Design","Development Partnership","Agent Access","General Enquiry"],"note":"We typically respond within one business day."}'::jsonb),
  ('properties_page', '{"label":"For Sale","headingHtml":"<em style=\"color:var(--gold)\">Current</em><br>Properties.","introTemplate":"{count} extraordinary residences across Brisbane''s most sought-after inner suburbs — each designed, developed, and built entirely in-house by Sabdia.","soldLabel":"Sold Prior to Completion","cta":{"label":"Private Enquiry","headingHtml":"Interested in a<br><em style=\"color:var(--gold)\">private viewing</em>?","text":"We offer private, exclusive viewings for serious buyers. Contact us to arrange an inspection at a time that suits you.","primaryCta":{"label":"Request a Viewing","href":"/contact/"},"secondaryCta":{"label":"Agent Enquiries","href":"/agent-access/"}}}'::jsonb),
  ('projects_page', '{"hero":{"image":"/images/home-hero-2.jpg","label":"Portfolio","titleHtml":"Our<br><em>Projects</em>","sub":"Over 100 residences delivered across inner Brisbane''s most prestigious suburbs since 2013."},"currentLabel":"For Sale — Current","soldLabel":"Sold Prior to Completion","cta":{"label":"Interested?","headingHtml":"Ready to find your<br><em>next home</em>?","primaryCta":{"label":"View For Sale","href":"/properties/"},"secondaryCta":{"label":"Enquire Now","href":"/contact/"}}}'::jsonb),
  ('services_page', '{"hero":{"image":"/images/home-hero-2.jpg","label":"What We Offer","titleHtml":"Our<br><em>Services</em>","sub":"Full-spectrum residential development expertise delivered entirely in-house."},"intro":{"label":"Integrated Approach","headingHtml":"Every element,<br><em>under one roof</em>.","paragraphs":["At Sabdia, we believe the best residential developments are those where design, development, and construction work as one seamless system — not as separate, disconnected disciplines. Our fully integrated in-house model is our defining advantage.","From the first sketch to the final handover, every decision is made by the same team, with the same vision, and the same commitment to excellence."]},"processLabel":"The Process","cta":{"label":"Start Your Project","headingHtml":"Ready to build something <em style=\"color:var(--gold2)\">remarkable</em>?","text":"Whether you have a site, a vision, or simply a desire for exceptional living — we''d love to hear from you.","primaryCta":{"label":"Begin a Conversation","href":"/contact/"},"secondaryCta":{"label":"View Properties","href":"/properties/"}}}'::jsonb),
  ('about_page', '{"hero":{"image":"/images/home-hero-1.jpg","label":"Our Story","titleHtml":"About<br><em>Sabdia</em>","sub":"A decade of redefining luxury residential development in inner Brisbane."},"mission":{"label":"Mission","headingHtml":"Built on <em>vision</em>,<br>delivered with<br>precision.","paragraphs":["Founded in 2013, Sabdia Constructions was born from a singular conviction: that the residential development industry in Brisbane deserved a boutique operator who refused to compromise. One that would bring together exceptional design, rigorous development management, and master-level construction under a single, unified vision.","Over a decade later, that conviction has been validated more than 100 times — in every residence we have delivered, in every client who has trusted us with their most significant investment, and in every award that has recognised our commitment to excellence.","We remain boutique by choice. By limiting the number of projects we undertake each year, we ensure that every development receives the full force of our attention, creativity, and craftsmanship. We do not build in volume. We build in detail."],"sigName":"Sabdia","sigTitle":"Founder & Principal"},"values":{"label":"Our Values","items":[{"n":"i.","title":"Integrity","desc":"We say what we do, and we do what we say. Transparency with our clients is non-negotiable at every stage of the journey."},{"n":"ii.","title":"Innovation","desc":"We push the boundaries of design and construction, constantly seeking better ways to create residences that will stand the test of time."},{"n":"iii.","title":"Excellence","desc":"We do not accept ''good enough''. Every detail, from the grandest architectural gesture to the smallest finishing touch, must be exceptional."}]},"journey":{"label":"Our Journey","headingHtml":"A decade of<br><em>milestones</em>.","text":"From a single vision to over 100 delivered residences, each year has brought new achievements and raised the bar for what luxury living in Brisbane can be.","items":[{"year":"2013","title":"Founded","desc":"Sabdia Constructions established with a vision to redefine boutique luxury residential development in inner Brisbane."},{"year":"2015","title":"First Award","desc":"Recognised with our first industry award for design excellence, validating the Sabdia approach to integrated development."},{"year":"2017","title":"50 Residences Delivered","desc":"A major milestone — 50 homes delivered to satisfied clients across inner Brisbane''s most prestigious suburbs."},{"year":"2020","title":"Interior Architecture Division","desc":"Expanded in-house capabilities to include a dedicated interior architecture team, deepening creative integration across all projects."},{"year":"2023","title":"100+ Residences","desc":"Surpassed 100 completed residences — a testament to a decade of consistency, quality, and unwavering commitment to excellence."},{"year":"2025","title":"QASR — Flagship Release","desc":"The launch of QASR, Coorparoo — Sabdia''s most ambitious and extraordinary residence to date, representing a new pinnacle of Brisbane luxury."}]},"awards":{"label":"Recognition","headingHtml":"Award-winning<br><em>excellence</em>.","items":[{"year":"2024","title":"Best Luxury Residential Development","org":"UDIA Queensland Awards"},{"year":"2023","title":"Excellence in Design","org":"HIA Australian Housing Awards"},{"year":"2022","title":"Best New Residential Development","org":"Property Council of Australia"},{"year":"2021","title":"Residential Interior Design — Luxury","org":"IDEA Awards"},{"year":"2020","title":"Custom Home of the Year — QLD","org":"Master Builders Queensland"},{"year":"2019","title":"Best Luxury Home Builder — Brisbane","org":"REIQ Awards for Excellence"}]},"cta":{"label":"Begin Your Journey","headingHtml":"Ready to create something <em>extraordinary</em>?","text":"Whether you''re seeking a current property for sale or have a vision for a bespoke home, we''d love to begin a conversation.","primaryCta":{"label":"View Properties","href":"/properties/"},"secondaryCta":{"label":"Get In Touch","href":"/contact/"}}}'::jsonb),
  ('collection_page', '{"label":"Our Work","titleHtml":"The Sabdia<br><em style=\"color:var(--gold)\">Collection</em>.","text":"A portfolio of completed luxury residences across inner Brisbane — each one designed, developed, and constructed entirely in-house by Sabdia.","items":[{"name":"ENCANTO","loc":"Camp Hill QLD, Australia","image":"/images/collection-encanto.jpg"},{"name":"NERO","loc":"Rochedale QLD, Australia","image":"/images/collection-nero.jpg"},{"name":"HERMOSA","loc":"Camp Hill QLD, Australia","image":"/images/collection-hermosa.jpg"},{"name":"FRASER","loc":"Graceville QLD, Australia","image":"/images/collection-fraser.jpg"},{"name":"CALLE","loc":"Camp Hill QLD, Australia","image":"/images/collection-calle.jpg"},{"name":"PETRA","loc":"Taringa QLD, Australia","image":"/images/collection-petra.jpg"},{"name":"KIRRA","loc":"Brisbane QLD, Australia","image":"/images/caspian-hero.jpg"}]}'::jsonb),
  ('agent_page', '{"hero":{"image":"/images/agent-portrait.jpg","label":"For Real Estate Professionals","titleHtml":"Exclusive<br><em style=\"color:var(--gold2)\">Agent</em><br>Access.","text":"Join Sabdia''s exclusive agent network and be the first to know about our next landmark development before it reaches the market."},"benefits":{"label":"Why Join","headingHtml":"The Sabdia agent program gives you <em style=\"color:var(--gold2)\">a genuine edge</em>.","items":[{"icon":"layers","title":"Pre-Release Access","desc":"Be first to know about upcoming developments before they reach the public market. Give your clients a genuine first-mover advantage."},{"icon":"plan","title":"Floor Plans & Pricing","desc":"Access pre-launch floor plans and indicative pricing information exclusively — everything you need to prepare your clients before public release."},{"icon":"phone","title":"Priority Communication","desc":"A dedicated Sabdia liaison to keep you informed, respond to questions, and support you throughout the sales process."},{"icon":"dollar","title":"Exclusive Commissions","desc":"Competitive and exclusive commission structures for agent network members — recognising the value of your relationships and referrals."},{"icon":"users","title":"Private Previews","desc":"Invitations to exclusive agent-only preview events — an opportunity to walk through completed or near-complete residences before public launch."},{"icon":"star","title":"Award-Winning Product","desc":"Represent Brisbane''s most acclaimed boutique luxury developer — a brand that your clients will immediately recognise as a hallmark of quality."}]},"listings":{"label":"Current Opportunities","headingHtml":"Properties available <em>now</em>.","cta":{"label":"View All Properties","href":"/properties/"}},"apply":{"label":"Apply for Access","headingHtml":"Join the <em>network</em>.","text":"Complete the form and a member of the Sabdia team will be in touch within one business day to discuss your application and confirm your access to our exclusive agent program.","noteLabel":"Please note","noteText":"The Sabdia agent program is available to licensed real estate professionals only. We may request verification of your licence at the time of application approval.","submitLabel":"Submit Application"}}'::jsonb),
  ('contact_page', '{"hero":{"label":"Get In Touch","titleHtml":"Let''s start<br>a <em style=\"font-style:italic;color:var(--gold2)\">conversation</em>.","text":"We''re always keen to hear from potential clients, real estate professionals, and development partners. Submit your details and we''ll be in touch shortly."},"directLabel":"Direct Contact","agentBlock":{"heading":"Agent Enquiries","bodyHtml":"Real estate professionals seeking exclusive agent access — pre-launch information, priority access and commission structures — please visit our <a href=\"/agent-access/\" style=\"color:var(--gold2);text-decoration:underline;text-underline-offset:3px\">Agent Access page</a>."},"map":{"image":"/images/home-hero-1.jpg","label":"Brisbane, Queensland"},"form":{"label":"Send a Message","interests":["Custom Home / Bespoke Build","Development Partnership","Agent Access","Media & Press","General Enquiry"],"submitLabel":"Submit Enquiry","note":"We respond within one business day."},"quickLinks":{"label":"You May Also Be Interested In","items":[{"tag":"For Sale","title":"Current Properties","desc":"View our current portfolio of luxury residences available for sale across Brisbane.","href":"/properties/"},{"tag":"Professionals","title":"Agent Access","desc":"Exclusive pre-launch information, priority access, and commission structures for real estate professionals.","href":"/agent-access/"},{"tag":"Company","title":"About Sabdia","desc":"Learn about our story, values, and integrated approach to boutique luxury development.","href":"/about/"}]}}'::jsonb),
  ('legal_privacy', '{"label":"Legal","titleHtml":"Privacy <em>Policy</em>.","updated":"July 2026","intro":"Sabdia Constructions Pty Ltd is committed to protecting your privacy in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles. This policy explains how we collect, use, and safeguard your personal information.","sections":[{"heading":"What we collect","bodyHtml":"When you submit an enquiry, register interest in a property, or apply for agent access, we collect the information you provide — typically your name, email address, phone number, and the details of your enquiry. Agent applicants may also provide their agency, licence number, and market areas. We do not collect sensitive information through this website."},{"heading":"How we use it","bodyHtml":"Your information is used solely to respond to your enquiry, keep you informed about the properties or programs you have expressed interest in, and improve our services. We do not sell, rent, or trade your personal information to third parties."},{"heading":"Storage and security","bodyHtml":"Enquiries are stored securely with our database provider and access is restricted to authorised Sabdia team members. We take reasonable steps to protect your information from misuse, interference, loss, and unauthorised access, modification, or disclosure."},{"heading":"Disclosure","bodyHtml":"We may share your information with trusted service providers who help us operate this website and communicate with you (for example, our email delivery provider). These providers are bound to handle your information only for the purpose of providing services to us."},{"heading":"Cookies and analytics","bodyHtml":"This website may use privacy-friendly analytics to understand how visitors use the site. Analytics data is aggregated and does not identify you personally."},{"heading":"Access and correction","bodyHtml":"You may request access to, or correction of, the personal information we hold about you at any time by contacting us. We will respond within a reasonable period."},{"heading":"Contact","bodyHtml":"For any privacy-related questions or requests, contact us via the enquiry form on this website or by email. If you are not satisfied with our response, you may contact the Office of the Australian Information Commissioner (OAIC)."}]}'::jsonb),
  ('legal_accessibility', '{"label":"Legal","titleHtml":"Accessibility <em>Statement</em>.","updated":"July 2026","intro":"Sabdia Constructions is committed to ensuring this website is accessible to the widest possible audience, regardless of technology or ability. We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 at Level AA.","sections":[{"heading":"What we do","bodyHtml":"This website is built with semantic HTML landmarks, supports full keyboard navigation with visible focus states, maintains WCAG AA colour contrast, provides descriptive alternative text for images, and respects your system''s reduced-motion preference by disabling non-essential animation."},{"heading":"Known limitations","bodyHtml":"Some third-party embedded content (such as interactive 3D models and virtual tours) may not be fully accessible. Where these features appear, the same property information is always available in accessible text form on the same page."},{"heading":"Feedback","bodyHtml":"We welcome your feedback on the accessibility of this website. If you encounter an accessibility barrier, please contact us via the enquiry form and we will make every reasonable effort to address it promptly."}]}'::jsonb),
  ('notfound', '{"label":"404","titleHtml":"This page has<br><em>moved on</em>.","text":"Like our finest residences, the page you''re looking for has found a new owner — or never existed at all. Let us guide you back.","primaryCta":{"label":"Return Home","href":"/"},"secondaryCta":{"label":"View Properties","href":"/properties/"}}'::jsonb)
on conflict (key) do nothing;

insert into services (sort, number, title, description, icon, label, detail)
select * from (values
  (1, '01', 'Luxury Residential Design', 'Bespoke single residences and boutique developments designed for discerning clients. From architectural concept to interior finishing — every detail considered, nothing left to chance.', 'home', 'Service One', '{"headingHtml":"Luxury Residential <em>Design</em>","image":"/images/home-hero-1.jpg","alt":"Luxury Residential Design","paragraphs":["Our in-house architecture and design team creates residences that are as functional as they are breathtaking. We approach each project as a singular creative endeavour — absorbing the site''s character, the client''s aspirations, and the neighbourhood''s context before a single line is drawn.","The result is homes that feel inevitable — as though they could not have existed anywhere else, built for anyone else, or been conceived by any other studio."],"bullets":["Architectural concept and schematic design","Design development and documentation","Planning approvals and DA management","Landscape architecture","Material and finishes specification","3D visualisation and virtual walkthroughs"]}'::jsonb),
  (2, '02', 'Development Management', 'End-to-end residential development managed from vision to completion. Our integrated in-house model maintains meticulous control over quality, timing, and innovation throughout.', 'case', 'Service Two', '{"headingHtml":"Development <em>Management</em>","image":"/images/solace-hero.jpg","alt":"Development Management","paragraphs":["Development management is the complex art of orchestrating every moving part of a residential project — land acquisition, town planning, engineering, approvals, finance, sales, and delivery — into one coherent, high-performing whole.","Sabdia handles this process entirely in-house. This means fewer delays, tighter budgets, faster approvals, and a development that performs as well on paper as it does in person."],"bullets":["Site acquisition analysis and due diligence","Feasibility modelling and investment structuring","Town planning strategy and DA management","Engineering and civil coordination","Sales and marketing strategy","Project reporting and stakeholder management"]}'::jsonb),
  (3, '03', 'Interior Architecture', 'Integrated interior architecture that elevates every space. Our design team collaborates closely with builders to ensure perfect cohesion between vision and reality.', 'clock', 'Service Three', '{"headingHtml":"Interior <em>Architecture</em>","image":"/images/sierra-hero.jpg","alt":"Interior Architecture","paragraphs":["Our interior architecture division ensures that the lived experience of a Sabdia home is as extraordinary as its exterior presence. Working in close collaboration with the architecture team from day one, our interior architects shape spaces that are luminous, considered, and deeply personal.","Every kitchen, bathroom, bedroom, and living space is designed as part of a holistic vision — where each room flows effortlessly into the next, and light, material, and proportion conspire to create homes that feel genuinely special."],"bullets":["Interior concept and spatial design","Custom joinery design and specification","Material, finish, and hardware selection","Lighting design and coordination","FF&E procurement and styling","Kitchen and bathroom design"]}'::jsonb),
  (4, '04', 'Expert Construction', 'Premium construction by master tradespeople. We use only the finest materials and proven methodologies — delivered with full transparency and precision at every stage.', 'grid', 'Service Four', '{"headingHtml":"Expert <em>Construction</em>","image":"/images/caspian-hero.jpg","alt":"Expert Construction","paragraphs":["Sabdia''s construction arm brings the vision to life with precision, skill, and an obsessive attention to detail. Our team of master tradespeople — many of whom have worked with Sabdia for years — share our commitment to doing everything properly.","We use only the finest materials, source from trusted suppliers, and never cut corners. The result is a home that not only looks extraordinary on the day of handover, but continues to perform to the highest standard for decades to come."],"bullets":["Full residential construction management","Premium material sourcing and procurement","Master tradesperson coordination","Quality assurance and defect management","Client reporting and site access","Post-completion aftercare and warranty"]}'::jsonb)
) as v(sort, number, title, description, icon, label, detail)
where not exists (select 1 from services);

insert into process_steps (sort, title, description)
select * from (values
  (1, 'Design', 'Visionary design that balances beauty, functionality, and long-term value. Every project begins with a deep understanding of site, context, and client.'),
  (2, 'Develop', 'We manage the complete development process in-house — approvals, planning, engineering — maintaining full control over every decision and outcome.'),
  (3, 'Construct', 'Precision construction by our own team of master tradespeople, using premium materials and meticulous quality control at every stage of the build.'),
  (4, 'Deliver', 'Handover marks the beginning of your story. Our aftercare ensures your home continues to perform and delight for decades to come.')
) as v(sort, title, description)
where not exists (select 1 from process_steps);

insert into testimonials (sort, quote, attribution)
select * from (values
  (1, 'Sabdia delivered a home that exceeded every expectation. Their integrated approach — from design through to construction — meant every detail was perfectly executed. A truly exceptional result that we will treasure for generations.', 'Satisfied Client — Inner Brisbane Residence')
) as v(sort, quote, attribution)
where not exists (select 1 from testimonials);

-- Grant Naomi admin access (no-op until her auth user exists)
insert into admin_users (user_id, email, role) select id, email, 'admin' from auth.users where lower(email) = 'naomi@sabdia.com.au' on conflict (user_id) do nothing;
