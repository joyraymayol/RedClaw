# RedClaw CMMS — Auth & User Provisioning Strategy

Companion notes to `redclaw-cmms-plan.md`, covering how employee identities get into the system at launch and how sign-in reconciles across methods (email/password vs. Google).

> **Decision (2026-07-13):** self-serve Google sign-up + admin approval is the **primary** provisioning path (implemented in Phase 0). Bulk email invites (§5) are deferred to a future in-app admin action.

---

## 1. Primary path: self-serve Google sign-up + admin approval

Employees seed their own accounts — even before launch — by signing in with Google (personal Gmail accounts; no Workspace domain restriction available):

1. **Sign-up = Google sign-in.** There is no registration form. "Continue with Google" creates the `auth.users` row; a Postgres mirror trigger (`on_auth_user_created`, see §2) immediately creates `public.User` with `status = PENDING_PROFILE`, `role = NULL`, `isActive = false`, name/avatar prefilled from Google metadata.
2. **Profile completion (`/onboarding`).** First sign-in routes to a form: full name (prefilled), department + position (dropdowns from `src/lib/constants/org.ts`). Submitting moves the account to `status = PENDING_APPROVAL`.
3. **Holding page (`/pending-approval`).** Until approved, every sign-in lands here — the account can access nothing. `requireActiveUser()` in `src/lib/auth.ts` denies by construction for any non-`ACTIVE` status.
4. **Admin review (`/admin/users`).** ADMIN/HEAD users see all accounts, pending first, and approve by assigning one of the five roles (`status → ACTIVE`, `isActive → true`). **Verify people by their email** — the email is Google-verified; the typed name/department are self-reported. Accounts can also be disabled there.

**Account lifecycle:** `PENDING_PROFILE → PENDING_APPROVAL → ACTIVE` (+ `DISABLED`), stored as an explicit `AccountStatus` enum on `User` — one authoritative column instead of inferring state from `role IS NULL` in several places.

**Admin bootstrap:** the first admin can't be approved by anyone. `prisma/seed.ts` promotes the emails in `ADMIN_BOOTSTRAP_EMAILS` to ADMIN/ACTIVE after their first Google sign-in (`npm run db:seed`).

## 2. Mirror trigger (auth.users → public.User)

`prisma/migrations/*_auth_user_mirror/migration.sql` (hand-written SQL — never `prisma db push`):

- `AFTER INSERT ON auth.users` → insert `public."User"` with id/email/name/avatar from `raw_user_meta_data`, `ON CONFLICT DO NOTHING`.
- A client that never calls a sync endpoint can't skip it. `getCurrentUser()` also has an upsert fallback for rows that predate the trigger.
- Same migration enables RLS (no policies) on `public."User"` so Supabase's anon/authenticated REST roles can't touch it; all app access goes through Prisma as the table owner.

## 3. Sign-in methods & password recovery

Both doors stay open on `/login`:

- **Google** (the only sign-*up* path) — `signInWithOAuth` → `/auth/callback` (code exchange) → DAL routes by status.
- **Email + password** — for accounts that added a password later (see §4). No password sign-up exists; Supabase's email-provider sign-ups should be disabled in the dashboard (Google provider stays on).

**Forgot / set password:** `/forgot-password` → `resetPasswordForEmail` → email link → `/auth/callback?next=/reset-password` → set new password. For Google-only accounts this is also how a password gets **added** to the account (the form copy says so).

## 4. Cross-method sign-in behavior (Supabase automatic identity linking)

Governed by Supabase's automatic identity linking, which links by **verified email** — asymmetric depending on which method came first.

**Signed up via Google → sign in with email+password later?**
Not immediately. Google signup creates the `auth.users` row with a Google identity but no password. The user gains password sign-in via "Forgot password" (`resetPasswordForEmail` → `updateUser({ password })`), which sets a password on that same account. After that, both methods work on the one row.

**Signed up via email+password → sign in with Google later?**
Yes, automatically — provided the original email was confirmed. Google's OAuth email is always verified, and Supabase auto-links a new OAuth identity to an existing account when both sides have a verified email. Same `auth.users.id`, same mirrored `public.User` row, same role.

**Caveat:** auto-linking depends on email confirmation having actually happened on the first method. Keep "Confirm email" **enabled** in Supabase Authentication settings.

## 5. Deferred: bulk email invites

The previously planned invite flow stays viable as a future admin convenience ("Invite employee" action for new hires), but is no longer launch-blocking:

```ts
await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
  data: { name, role, department },
  redirectTo: `${APP_URL}/accept-invite`,
});
```

If/when built: the mirror trigger already reads `raw_user_meta_data`, so invited users would arrive with name prefilled; an `/accept-invite` page (set password) would be added then. Invited-with-role provisioning would need the trigger extended to read a `role` key.

## 6. Security posture

- The **DAL is the boundary** (`src/lib/auth.ts`): Next.js 16's proxy doesn't intercept Server Actions and layouts don't re-render on navigation, so every protected page and every Server Action calls `requireUser` / `requireActiveUser` / `requireRole`. Rule: no Prisma write without a `require*` call above it.
- `supabase.auth.getUser()` (JWT validated server-side) everywhere — never `getSession()`.
- Once the app URL is public, anyone can create a *pending* account; the pending gate plus admin approval is the intended control. Impersonation of a colleague's name is caught at review time (procedural: check the roster against the Google-verified email).
- Google OAuth consent screen: while in "Testing" mode only listed test users can sign in (cap 100); publish before employee rollout.
