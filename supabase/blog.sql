-- ============================================================
-- BLOG — "The Sabdia Journal"
-- Mirrors the existing content-table patterns exactly:
-- public read of published rows (+ portal preview of drafts),
-- portal write via is_admin_user(), audit + updated_at triggers.
-- Safe to re-run.
-- ============================================================

create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text not null default '',
  body text not null default '',            -- markdown-lite: blank-line paragraphs, ## subheadings
  hero_image text not null default '',
  hero_alt text not null default '',
  category text not null default '',
  tags text[] not null default '{}',
  author text not null default 'Sabdia Constructions',
  published boolean not null default false,
  published_at timestamptz,
  seo_title text not null default '',
  seo_description text not null default '',
  og_image text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table blog_posts enable row level security;

drop policy if exists "Public read access" on blog_posts;
create policy "Public read access" on blog_posts
  for select using (published = true or is_admin_user());

drop policy if exists "Admin write access" on blog_posts;
create policy "Admin write access" on blog_posts
  for all using (is_admin_user()) with check (is_admin_user());

drop trigger if exists audit_blog_posts on blog_posts;
create trigger audit_blog_posts
  after insert or update or delete on blog_posts
  for each row execute function log_audit();

drop trigger if exists touch_blog_posts on blog_posts;
create trigger touch_blog_posts
  before update on blog_posts
  for each row execute function touch_updated_at();
