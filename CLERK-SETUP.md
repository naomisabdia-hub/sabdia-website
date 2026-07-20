# Switching admin sign-in to Clerk

The admin portal supports two sign-in modes. **Today it runs on Supabase
auth** (email + password / email link). The moment a Clerk publishable key
is present in the environment, the portal switches to **Clerk mode**
automatically — Clerk's polished sign-in screen, sessions, and user
management take over. No code changes needed; removing the key switches
back.

## One-time setup (about 15 minutes)

### 1. Create the Clerk application
1. Sign up / sign in at https://dashboard.clerk.com
2. **Create application** → name it `Sabdia Admin` → enable **Email**
   sign-in (passkeys/Google optional, your call).
3. From **Configure → API keys**, copy the **Publishable key** (`pk_…`)
   — you'll need it in steps 3 and 4.

### 2. Connect Clerk to Supabase
1. In the Clerk dashboard: **Configure → Integrations → Supabase**
   (also reachable via https://dashboard.clerk.com/setup/supabase) →
   **Activate**. This makes Clerk's session tokens carry the
   `"role": "authenticated"` claim Supabase expects, and shows you a
   **Clerk domain** (e.g. `https://your-app.clerk.accounts.dev`).
2. In the Supabase dashboard (project `sabdia-website`):
   **Authentication → Sign In / Providers → Third-party Auth →
   Add integration → Clerk** → paste that Clerk domain.
3. In the Supabase **SQL Editor**, run the whole of
   [`supabase/clerk-auth.sql`](supabase/clerk-auth.sql) once. It teaches
   the database to recognise Clerk identities (matched by email) and
   lets Admins manage the team from the portal's Settings page. It is
   safe to run right now — Supabase-auth sign-ins keep working.

### 3. Add the key to the environments
Local — add to `.env`:
```
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_…
```
Vercel — `vercel env add PUBLIC_CLERK_PUBLISHABLE_KEY` (or Dashboard →
Project → Settings → Environment Variables), then redeploy:
```
vercel deploy --prod
```

### 4. First sign-in
1. Visit `/admin/login/` — you'll see Clerk's sign-in screen.
2. Sign in with **Naomi@sabdia.com.au** (create the account if prompted —
   use the same email; portal access is matched by email address).
3. Add teammates under **Admin → Settings → Team access**: enter their
   email + role. They then sign up at `/admin/login/` with that email.

## Notes
- **Roles**: `admin` = everything incl. team management; `editor` =
  content and properties only. Roles live in the `admin_users` table and
  are managed from Settings.
- **Rollback**: remove `PUBLIC_CLERK_PUBLISHABLE_KEY` from Vercel and
  redeploy — the portal instantly returns to Supabase email-link sign-in.
- The public website is untouched by all of this; Clerk protects only
  `/admin`. Data writes are enforced by Supabase row-level security
  either way, so the static admin pages expose nothing.
