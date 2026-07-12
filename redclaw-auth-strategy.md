# RedClaw CMMS — Auth & User Provisioning Strategy

Companion notes to `redclaw-cmms-plan.md`, covering how employee identities get into the system at launch and how sign-in reconciles across methods (email/password vs. Google).

---

## 1. Seeding employees: pre-invite, don't pre-insert

Don't seed `public.User` rows directly from the head admin's employee email list. A `User` row with no matching `auth.users` row is orphaned — the Postgres mirror trigger creates `public.User` *from* `auth.users`, not the other way around, so a hand-inserted row can never be logged into.

Instead, the admin's employee list drives a **bulk invite** via Supabase's Admin API:

```ts
await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
  data: { name, role, department },
  redirectTo: `${APP_URL}/accept-invite`,
});
```

This immediately creates the real `auth.users` row (known UUID) and fires the mirror trigger, which reads `raw_user_meta_data` to populate `public.User.role` correctly from day one. Supabase emails each employee an invite link.

- Launch day: run as a one-off `scripts/bulk-invite.ts` against the admin's list.
- Ongoing: promote the same function into an in-app "Invite employee" admin action for new hires.

## 2. First sign-in

Clicking the invite link lands the employee on `/accept-invite` with a valid Supabase session, where they set a password (`supabase.auth.updateUser({ password })`). From then on they can sign in with email + password.

**"Continue with Google" maps directly to the same account** — since the account (and email) already exists from the invite, and the invite-accept step confirms the email, Google OAuth against that same email links automatically. No extra admin step, no duplicate row; role is already present from the seed.

## 3. Unmatched Google sign-in (walk-ins not on the list)

Google OAuth isn't restricted to the seed list unless the Google provider is also configured with domain restriction (`hd` param) — a cheap extra filter, but not the security boundary.

Handle it explicitly:
- Mirror trigger: if no invite metadata exists on the new `auth.users` row, create `public.User` with `role = NULL`, `isActive = false`.
- `getCurrentUser()` / middleware: `role IS NULL` → redirect to a "Pending approval — contact your maintenance admin" holding page, not the app shell. `authz.can()` denies everything for a null role by construction.
- Admin gets a **Pending Users** screen (`User` rows where `role IS NULL`) to assign a role and flip `isActive = true`. Next login, they're in.

## 4. Forgot password

Already stubbed in `src/components/auth/forgot-password-form.tsx`. Standard flow:

1. `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/reset-password' })`
2. Email link → `/reset-password` → `supabase.auth.updateUser({ password })` using the recovery session Supabase attaches to the redirect.

Nice-to-have (not launch-blocking): detect via an admin-privileged (service role) lookup when an account has no password credential yet and only signs in via Google, and tailor the "forgot password" messaging accordingly instead of silently emailing a reset link.

## 5. Cross-method sign-in behavior (Supabase automatic identity linking)

Governed by Supabase's automatic identity linking, which links by **verified email** — asymmetric depending on which method came first.

**Signed up via Google → sign in with email+password later?**
Not immediately. Google signup creates the `auth.users` row with a Google identity but no password set. The user gains password sign-in only after going through "Forgot password" (`resetPasswordForEmail` → `updateUser({ password })`), which sets a password on that same account (matched by email). After that, both methods work on the one row.

**Signed up via email+password → sign in with Google later?**
Yes, automatically — provided the original email was confirmed. Google's OAuth email is always verified on Google's side, and Supabase auto-links a new OAuth identity to an existing account when both sides have a verified email for that address. "Continue with Google" becomes a second door into the same `auth.users.id` / same mirrored `public.User` row / same role. No duplicate account, no admin step.

**Why this matters for our invite-based design:** employees arrive via the invite-accept link, which confirms their email as part of acceptance. By the time any of them clicks "Continue with Google," their email is already verified server-side — so Google sign-in cleanly links to their pre-provisioned, pre-roled account every time. The "unmatched Google email" case (§3) only applies to genuine walk-ins who were never invited.

**Caveat:** auto-linking depends on email confirmation having actually happened on the first method. If "Confirm email" is ever disabled in the Supabase project's Authentication settings, linking can behave differently (may error instead of link). Worth confirming that setting is on before launch, since this whole reconciliation story leans on it.

## 6. Plan doc delta

`redclaw-cmms-plan.md`'s auth notes (mirror trigger via Postgres trigger on `auth.users`) should be tightened to:
- Read `user_metadata` (role/name/department) in the trigger for the invited case.
- Add the `role IS NULL` → pending-approval branch for the walk-in case.
- Add the bulk-invite script / admin "Invite employee" action and "Pending Users" screen to the Phase 0 task list.
