-- Catch-all for enquiry form fields: every submitted field that isn't one of
-- the fixed columns is stored here as JSON, so new or renamed form fields can
-- never be silently dropped. Safe to re-run.
alter table enquiries add column if not exists details jsonb not null default '{}'::jsonb;
