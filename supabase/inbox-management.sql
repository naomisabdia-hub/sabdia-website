-- ── Inbox management: delete, edit, and replies ────────────────
-- Run this in the Supabase SQL editor (dashboard → SQL) — it is not
-- applied automatically. Prerequisite: is_admin_user() from
-- clerk-auth.sql (or schema.sql's earlier definition) already exists.
--
-- What it enables:
--   1. Portal users can DELETE leads (the inbox previously kept
--      everything forever by design; the owner now wants delete).
--   2. Portal users can UPDATE every lead field, not just status/notes
--      (the existing "Admin update access" policy already allows this —
--      nothing to add; listed here for the record).
--   3. A `replies` table logging every reply sent from the inbox, so
--      the thread shows against each enquiry.

-- 1. Delete access for portal users.
drop policy if exists "Admin delete access" on enquiries;
create policy "Admin delete access" on enquiries
  for delete using (is_admin_user());

-- 3. Sent replies. Rows are written by the server-side /api/reply
-- endpoint using the service role (which bypasses RLS); portal users
-- only ever read them.
create table if not exists replies (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references enquiries(id) on delete cascade,
  to_email text not null,
  subject text not null,
  body text not null,
  sent_by text,
  sent_at timestamptz not null default now()
);
create index if not exists replies_enquiry_idx on replies (enquiry_id, sent_at);

alter table replies enable row level security;
drop policy if exists "Admin read access" on replies;
create policy "Admin read access" on replies for select using (is_admin_user());
