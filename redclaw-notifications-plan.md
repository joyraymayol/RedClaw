# Redclaw CMMS — In-App Notifications (phased)

## Progress log — where we left off

_Single source of truth for resuming. Rule: finish one phase, run the gate, then STOP and wait for the user's go-ahead before starting the next._

- [x] **Phase 1 — Data layer + emit plumbing** — DONE 2026-07-23. `Notification` model + `NotificationType` enum in `schema.prisma`; migration `20260723000001_notifications` applied to the shared dev DB (`migrate diff` clean); `src/lib/notifications.ts` (emit helpers + recipient resolvers + read helpers); `src/lib/actions/notifications.ts` (mark-read + poll actions); `src/lib/notifications.test.ts` (10 tests). Gate green: typecheck / lint / 242 tests / build. No emit points wired and nothing user-visible yet — that's expected.
- [x] **Phase 2 — Bell UI + 45s poll + first event (ticket assignment)** — DONE 2026-07-24. `src/components/layout/notification-bell.tsx` (bell + unread `Badge` + `DropdownMenu modal={false}` recent-10 list, 45s `setInterval` poll, mark-read-on-click, "Mark all read"); wired into `(app)/layout.tsx` header. Added a new `TICKET_ON_HOLD` notification type (migration `20260724000001_notification_ticket_on_hold`) — not in the original draft enum — for technicians whose in-progress ticket gets bumped by a priority preempt; none of the existing types fit. Wired `assignTicket` (`TICKET_ASSIGNED` to newly assigned techs, `TICKET_ON_HOLD` to preempted techs) and `updateAssignees` (`TICKET_ASSIGNED`/`TICKET_UNASSIGNED` for the diff) in `actions/tickets.ts`, both inside their existing `$transaction`. Gate green: typecheck / lint / 242 tests / build / `migrate diff` clean. Browser QA (Playwright against the live dev server, disposable `*.test@example.com` accounts): assign → technician's bell badge appears pre-dropdown-open, dropdown lists the item, click marks read + navigates to `/tickets/{id}`; add-then-remove via "Manage team" → removed technician gets `TICKET_UNASSIGNED`. Zero console errors on both sides.
  - **Bugs found + fixed during QA:** (1) `DropdownMenuLabel` renders Base UI's `Menu.GroupLabel`, which throws outside a `Menu.Group` — swapped for a plain `<span>` header. (2) The long-running local `next dev` process had a stale `PrismaClient` singleton (cached on `globalThis` since before Phase 1's migration) that predated the `Notification` model entirely — required a dev-server restart to pick up `prisma generate` output; not an app bug, but worth remembering if `prisma.notification` ever looks `undefined` again mid-session.
  - Not yet covered by browser QA: the priority-preempt (`TICKET_ON_HOLD`) path — validated by code review + the transaction's atomic rollback behavior, not a live click-through (staging an IN_PROGRESS-ticket-plus-HIGH/CRITICAL-preempt scenario was disproportionate for this pass). Worth a targeted check in Phase 5's full QA sweep.
- [x] **Phase 3 — Ticket lifecycle events** — DONE 2026-07-24. `runTransition` (`actions/tickets.ts`) gained an optional `notify?: (tx, ticket, toStatus, actorId) => Promise<void>` invoked right after `ticketStatusHistory.create`, inside the same transaction; `ticket` is the pre-transition snapshot (already loaded with `assignments` via `openAssignmentsInclude`). Added a new `supervisors()` recipient resolver (`src/lib/notifications.ts` + unit test) — active users with role ∈ {SUPERVISOR, HEAD}, department-agnostic, no ADMIN bypass — mirroring the `closeTicket`/`rejectReview` authz gate exactly (it's *not* the same pool as `maintenanceLeads`/`qaLeads`, which are dept-scoped). Wired: `resolveTicket` (type-aware — MAINTENANCE→requester `TICKET_VERIFY_REQUESTED`, PREVENTIVE_MAINTENANCE→supervisors `TICKET_REVIEW_REQUESTED`, MACHINE_SETUP→maintenance leads `SETUP_MAINTENANCE_APPROVAL`), `verifyTicket`→supervisors `TICKET_REVIEW_REQUESTED`, `closeTicket`→requester+assignees `TICKET_CLOSED`, `reopenTicket`/`rejectReview`→assignees `TICKET_REOPENED`, `rejectSetup`→assignees `SETUP_REJECTED`, `cancelTicket`→requester+assignees `TICKET_CANCELLED`, `createTicket`→`adminRecipients` `TICKET_NEEDS_ASSIGNMENT` (its own `$transaction`, not via `runTransition`). Gate green: typecheck / lint / 243 tests / build (no schema change this phase, so no migration).
  - **Browser QA** (Playwright, 4 concurrent contexts — requester/admin/technician/supervisor — against the live dev server): raised a MAINTENANCE ticket → admin's bell got `TICKET_NEEDS_ASSIGNMENT` → assigned → technician started work + resolved → requester's bell got `TICKET_VERIFY_REQUESTED`, clicked through and verified → supervisor's bell got `TICKET_REVIEW_REQUESTED`, clicked through and closed → both requester and technician got `TICKET_CLOSED`. Zero console errors across all four sessions.
  - **Not a bug, just noise:** the first two technicians tried (Tommy, then Theo) were both already mid-`IN_PROGRESS` on unrelated tickets from earlier QA sessions in this shared dev DB, correctly blocked by the existing 1-active-ticket guard — switched to Tina (verified free first). Worth a periodic cleanup of stale QA-only in-progress tickets if this keeps recurring.
- [x] **Phase 4 — Approval + production-plan events** — DONE 2026-07-24. Wired via the existing `notify` hook / transaction patterns, no new infra needed. `approveSetupMaintenance`→`qaLeads` `SETUP_QA_APPROVAL`; `approveSetupQa`→requester+assignees `TICKET_CLOSED` (both in `actions/tickets.ts`, using the `runTransition` `notify` hook from Phase 3). `submitPlan` (`actions/production-plans.ts`) converted from a bare `updateMany` into a `$transaction` so the `PLAN_APPROVAL_REQUESTED`→`planApprovers` write commits atomically with the status flip; `approvePlan`→`maintenanceLeads`+`plan.preparedById` (`PLAN_APPROVED`), added inside its existing transaction; `updatePlanRow`→`maintenanceLeads`+assignees of any non-closed setup ticket spun off that row (`row.tickets`, via `openAssignmentsInclude`) (`PLAN_ROW_CHANGED`), gated on `changes.length > 0` (i.e. only fires for edits to an already-`APPROVED` plan, matching the existing change-log gate — draft edits stay silent). `planApprovers`/`maintenanceLeads`/`qaLeads` resolvers all already existed from Phase 1, so no new resolver or migration this phase. Gate green: typecheck / lint / 243 tests / build (no schema change).
  - **Browser QA** (Playwright, 7 concurrent contexts — prod. staff/prod. head/maint. head/maint. sup/qa sup/admin/Tina — against the live dev server): built a real DRAFT plan + row via a scratch Prisma script (full plan-creation UI was already covered by the prior batch's QA), then drove every Phase 4 surface live: submit → prod. head (designated approver) got `PLAN_APPROVAL_REQUESTED`, approved → maintenance lead + preparer both got `PLAN_APPROVED` → created a Machine-Setup ticket off the row, assigned it to Tina → edited the row (approved plan) → Tina (setup-ticket assignee) and a maintenance lead both got `PLAN_ROW_CHANGED` → Tina started + resolved the ticket → maintenance lead got `SETUP_MAINTENANCE_APPROVAL` (a Phase 3 hook, exercised live for the first time here) → approved (Maintenance) → QA lead got `SETUP_QA_APPROVAL` → approved (QA) → both the requester (maintenance lead) and Tina got `TICKET_CLOSED`, and the machine's current mold flipped to the target product. Zero console errors across all seven sessions.
  - **Not a bug, just noise:** the first machine picked for the QA plan (Injection Molder #2) had a leftover open PM ticket from earlier QA sessions, which correctly blocked "Start work" on the new setup ticket (plan §6 rule: setup can't begin while the same machine has an open PM ticket) — switched to a machine with no open PM ticket (Extruder Line 5) instead of fighting the guard.
- [x] **Phase 5 — Full `/notifications` page, seed, full QA, gate** — DONE 2026-07-24. `src/app/(app)/notifications/page.tsx` — paginated inbox (All/Unread toggle with a live unread count badge, mirroring the tickets-list filter idiom) + `src/components/notifications/notification-list.tsx` (client: click-to-read with optimistic local state, "Mark all read", both calling the existing Phase 1 actions then `router.refresh()` so the toggle counts and pagination totals stay in sync). Added `countNotifications(userId, {unreadOnly})` to `src/lib/notifications.ts` (new — needed to compute `totalPages` before the itemized fetch, same two-query shape as the tickets/production-plans list pages). Reused the shared `src/lib/constants/pagination.ts` (10/20/30/50, default 10) rather than a dedicated `constants/notifications.ts` — on inspection most list pages (production plans, assets, knowledge base, PM checklists) share that generic module already; a per-page module is only used where a page needs extra table-specific constants (sort columns, wider page sizes), which this simple inbox doesn't. The bell dropdown's "See all" link (built ahead in Phase 2) now resolves. `prisma/seed.ts` gained `seedNotifications()` — a few sample rows across the `TEST_USERS` set (the only accounts the seed can guarantee), idempotent via a `findFirst`-guard (no natural unique key to upsert on, same pattern as the plan-seeding functions). Gate green: typecheck / lint / 243 tests / build / `migrate diff` clean (no schema change this phase).
  - **Browser QA:** ran `db:seed` against the shared dev DB — correctly detected existing notifications from Phases 2–4 QA and skipped (idempotency guard verified live; the insert branch itself is a straightforward `create` call, code-reviewed rather than forced on a throwaway fresh DB). Then, against a real inbox (12 accumulated notifications on `maint.head.test@example.com`): opened `/notifications` via the bell's "See all" link, clicked a row (unread count dropped 12→11, confirmed via the tab badge), switched to the Unread filter, changed rows-per-page, paged Next/Previous on the default page size, and "Mark all read" (confirmed via a direct DB check — `unread: 0` — after the UI briefly under-reported it, see below). Also closed out the Phase 2 follow-up: the priority-preempt path (`TICKET_ON_HOLD`) was still untested live — ran it end-to-end (technician starts a MEDIUM ticket → gets assigned a HIGH ticket → the MEDIUM one flips to `ON_HOLD` and the technician's bell gets `TICKET_ON_HOLD`), zero console errors. All QA sessions combined: zero console errors.
  - **Not a bug, just a test-script timing artifact:** right after the "Mark all read" click, the very next log line and screenshot still showed the old count (`Unread 11`) — worried this was a stale-write bug, but a direct Prisma query showed `unread: 0` and a fresh page load showed the "Unread" tab with no badge at all. The client's `router.refresh()` just hadn't repainted in the ~1s the script waited before capturing; not an app defect.

All 5 phases of the in-app notifications initiative are now shipped.

## Context

The Asset Overhaul and the Ticket-Types/Production-Plans/Machine-Setup batch are shipped (`819c27d`, clean tree). Both the CMMS roadmap (`redclaw-cmms-plan.md`, original Phase-1 step 12) and the last batch plan (`we-had-just-finished-glittery-flute.md`) name **in-app notifications as the top remaining gap** — the new PM / Machine-Setup / QA-approval / plan-approval flows added many handoffs where one person acts and another needs to know, but today nothing tells the downstream person. The last batch was deliberately written to make wiring a notification write trivial.

This is greenfield: exploration confirmed **no `Notification` model, no `createNotification`, no `notify*` helper, and no admin/approver recipient-lookup query exists anywhere** in `src/` or `prisma/`. The only related structure is `TicketStatusHistory` (audit log, not a per-user inbox).

**Goal:** a bell in the top bar with an unread badge + dropdown (and a full `/notifications` page), fed by notifications emitted at each ticket/plan handoff, so users see when something needs their attention.

**Decisions captured from the user:**
- **Freshness:** the bell **polls the unread count every ~45s** (no Supabase Realtime for now; smallest thing that works, matches the app's server-action style).
- **Surface:** **dropdown (recent ~10) + a dedicated paginated `/notifications` page**.
- **Shape:** small phases so no single phase is a big lift; each of Phases 2–5 is independently demoable.

**Out of scope (explicitly later per the roadmap):** email notifications (roadmap item 18), and everything else still-pending (Downtime/MTBF item 14, SLA editor+escalation item 16, reports item 17, KB curation item 19). Notifications are written so an email layer can hang off the same emit points later.

---

## Cross-cutting design (applies to all phases)

**Model** — append-only inbox row with a mutable `readAt` (idiomatic here; matches the `TicketMaterialLog`/`ProductionPlanRowChange` append-only-log grain, `String @id @default(uuid())`, single `@default(now())` stamp, no `updatedAt`):

```prisma
enum NotificationType {
  TICKET_ASSIGNED  TICKET_UNASSIGNED  TICKET_RESOLVED  TICKET_VERIFY_REQUESTED
  TICKET_REVIEW_REQUESTED  TICKET_CLOSED  TICKET_REOPENED  TICKET_CANCELLED
  SETUP_MAINTENANCE_APPROVAL  SETUP_QA_APPROVAL  SETUP_REJECTED
  PLAN_APPROVAL_REQUESTED  PLAN_APPROVED  PLAN_ROW_CHANGED
}

model Notification {
  id        String           @id @default(uuid())
  userId    String           // recipient
  actorId   String?          // who triggered it (null = system)
  type      NotificationType
  title     String           // rendered at emit time (denormalized)
  body      String?
  linkPath  String?          // e.g. /tickets/{id}, /production-plans/{id}
  readAt    DateTime?
  createdAt DateTime         @default(now())

  user  User  @relation("NotificationRecipient", fields: [userId], references: [id], onDelete: Cascade)
  actor User? @relation("NotificationActor", fields: [actorId], references: [id], onDelete: SetNull)

  @@index([userId, readAt])     // unread-count query
  @@index([userId, createdAt])  // inbox list
}
```
User gains two **named** back-relations (multiple relations to User require names — mirrors `TicketAssignment`'s `AssignedBy`/`AssignedTechnician`): `notifications Notification[] @relation("NotificationRecipient")` and `notificationsActed Notification[] @relation("NotificationActor")`.

**Migration** — hand-written `prisma/migrations/20260723000001_notifications/migration.sql` (next in the `20260722000001…` monotonic-per-day sequence). Follow the verbatim boilerplate from `20260722000002_ticket_material_log`: `CREATE TYPE … AS ENUM`, `CREATE TABLE` with `TEXT`/`TIMESTAMP(3)` columns, two `CREATE INDEX`, `ADD CONSTRAINT …_fkey` (userId `ON DELETE CASCADE`, actorId `ON DELETE SET NULL`, both `ON UPDATE CASCADE`), then `-- RowLevelSecurity` + `ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;` (no policy — deny-all posture, same as every other table). Must pass `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` (CI drift gate). Runtime client `@/lib/prisma`; generated types `@/generated/prisma/client`.

**Emit helpers** — new `src/lib/notifications.ts` (transaction-aware, so writes join the same `$transaction` as the state change):
- `createNotification(tx, { userId, actorId, type, title, body?, linkPath })` — **no-op when `userId === actorId`** (never notify yourself).
- `notifyUsers(tx, userIds[], payload)` — de-dupes recipients and drops the actor, then creates rows.
- Recipient resolvers (these queries **don't exist yet**, filter to `status: "ACTIVE"`): `adminRecipients(tx)` (ADMIN+HEAD), `maintenanceLeads(tx)`/`qaLeads(tx)` (dept + role∈{HEAD,SUPERVISOR}, reusing the `isMaintenanceHigher`/`isQaHigher` shape from `authz.ts:77-90`), `planApprovers(tx)` (`tx.productionPlanApprover.findMany` — only `findUnique` exists today).

**Reused utilities (do not reinvent):** `runTransition` + `openAssignmentsInclude` + `toTicketContext` (`src/lib/ticket-context.ts`, `actions/tickets.ts:254-293`); `diffIds` (`lib/id-diff.ts`); `getCurrentUser`/`requireActiveUser` (`lib/auth.ts`); `dropdown-menu.tsx` + `badge.tsx` (both Base UI, already installed); `PaginationBar`/`PerPageSelect`/`DebouncedSearchInput`/`ListNavProvider` for the full page; `revalidatePath`. Base-UI gotchas: `render` prop not `asChild`, pass `modal={false}` to the dropdown root so the open menu doesn't `inert`/scroll-lock the page, `nativeButton={false}` only if a trigger renders as a link.

---

## Phase 1 — Data layer + emit plumbing (invisible, fully tested)

Smallest slice; ships no UI but everything below builds on it.
- Add `NotificationType` + `Notification` to `prisma/schema.prisma` (+ the two User back-relations); write & apply the `20260723000001_notifications` migration; `prisma generate`; confirm `migrate diff` empty.
- `src/lib/notifications.ts`: `createNotification` (self-notify skip), `notifyUsers`, and the four recipient resolvers.
- `src/lib/actions/notifications.ts`: `markNotificationRead(id)` / `markAllRead()` (own rows only, `revalidatePath`), plus read helpers `getUnreadCount(userId)`, `listRecentNotifications(userId, take)`, `listNotifications(userId, {page, perPage, unreadOnly})`, and a thin `fetchUnreadCount()` action for the poller.
- Unit tests (`src/lib/notifications.test.ts`): self-notify skip, `notifyUsers` de-dupe + actor-drop, resolver role/dept/status filters.
- **Gate:** typecheck / eslint / vitest / build + `migrate diff` empty.

## Phase 2 — Bell UI + polling + first event (assignment) = first end-to-end slice

- `src/components/layout/notification-bell.tsx` (Client island) placed in the `ml-auto` cluster of `src/app/(app)/layout.tsx:66-72`, before `SignOutButton`. `user.id` is already in scope to pass as a prop. Unread `Badge` over a `Button variant="ghost" size="icon"` bell; `DropdownMenu modal={false}` listing recent ~10 (title/body/relative time), each row a `render={<Link href={linkPath}/>}` that fires `markNotificationRead`; a "Mark all read" header action.
- Poll: `setInterval(45s)` → `fetchUnreadCount()` inside `startTransition`, updating the badge; opening the dropdown loads the recent list.
- **Wire the first emit points** — `assignTicket` (`actions/tickets.ts:626`) and `updateAssignees` (`:745`): notify **added** technicians (`TICKET_ASSIGNED`, link `/tickets/{id}`), notify **removed** technicians (`TICKET_UNASSIGNED`), and on priority-preempt notify the **bumped** technicians whose tickets went `ON_HOLD`. `addedTechnicians`/`removedTechnicians`/`busyTickets` are already in scope.
- **Demo:** admin assigns a ticket → the technician's bell shows a badge within ~45s (instantly on their next navigation).
- **Gate** + a quick browser check.

## Phase 3 — Ticket lifecycle events (one hook in `runTransition`)

- Extend `runTransition` (`actions/tickets.ts:254-293`) with an optional `notify?: (tx, ticket, toStatus) => Promise<void>` invoked right after the `ticketStatusHistory.create` — `ticket.requesterId` and `ticket.assignments[].technicianId` are already loaded there via `openAssignmentsInclude`.
- Supply `notify` for: `resolveTicket` (type-aware recipients — MAINTENANCE→requester `TICKET_VERIFY_REQUESTED`, PM→supervisors `TICKET_REVIEW_REQUESTED`, MACHINE_SETUP→maintenance leads `SETUP_MAINTENANCE_APPROVAL`), `verifyTicket`→supervisors, `closeTicket`→requester+assignees `TICKET_CLOSED`, `reopenTicket`/`rejectReview`/`rejectSetup`→assignees `TICKET_REOPENED`/`SETUP_REJECTED`, `cancelTicket` (admin-initiated)→requester+assignees. `createTicket`→`adminRecipients` (`TICKET_ASSIGNED`-adjacent "needs assignment"; its own `$transaction` at `:93-142`).
- **Gate** + browser check of the resolve→verify→close path.

## Phase 4 — Approval + production-plan events

- `approveSetupMaintenance` (`:509`)→`qaLeads` (`SETUP_QA_APPROVAL`); `approveSetupQa` (`:524`)→requester+assignees (`TICKET_CLOSED`).
- `submitPlan` (`production-plans.ts:136`)→`planApprovers` (`PLAN_APPROVAL_REQUESTED`, link `/production-plans/{id}`) — needs the new `findMany`; `approvePlan` (`:155`)→`maintenanceLeads` + `plan.preparedById` (`PLAN_APPROVED`); `updatePlanRow` post-approval (`:225`)→`maintenanceLeads` + assignees of any setup ticket already spun off that row (`row.tickets`) (`PLAN_ROW_CHANGED`).
- **Gate** + browser check of a plan submit→approve and a setup Maintenance→QA approval.

## Phase 5 — Full `/notifications` page, seed, QA, gate

- `src/app/(app)/notifications/page.tsx` — paginated inbox reusing the list idiom (`PaginationBar` + `PerPageSelect`, an unread/all toggle, mark-all-read); the dropdown's "See all" links here. Its own `constants/notifications.ts` per the one-module-per-list convention.
- `prisma/seed.ts`: a few sample notifications across the existing test users so the bell is populated on a fresh DB.
- Full browser QA across roles + the full gate.

---

## Verification (end-to-end, browser QA)

Use the established disposable accounts (`*.test@example.com`, password `AssetQA-2026!`, incl. the dept-specific ones) against the live Supabase dev server (Playwright). Confirm, with zero console errors:
1. **Assignment:** admin assigns a ticket → assigned technician's bell shows an unread badge (≤45s or on nav) → clicking the item marks it read and lands on `/tickets/{id}`.
2. **Lifecycle:** technician resolves a MAINTENANCE ticket → requester notified to verify → verify → supervisor notified to review → close → requester + technician notified.
3. **Setup approvals:** Machine-Setup resolve → maintenance lead notified → Maintenance approve → QA lead notified → QA approve → requester/technician notified.
4. **Production plan:** Production staff submits a plan → designated approver notified → approve → Maintenance leads + preparer notified; a post-approval row edit notifies Maintenance.
5. **Hygiene:** you never get a notification for your own action; mark-all-read clears the badge; the `/notifications` page paginates and the unread filter works.
6. Re-run the full `lint` / `typecheck` / `test` / `build` gate + the CI `migrate diff` drift check.

## Notes / assumptions the user can override
- **Polling interval 45s** and **recipient role mapping** (admins+HEAD for "needs assignment"; dept-scoped HEAD/SUPERVISOR for approvals, matching the existing authz gates) are the defaults — easy to tune.
- Notifications are **best-effort inside the same transaction** as the state change: if the action commits, the notification commits with it (never a separate write that could half-fail).
- Email (roadmap item 18) is intentionally deferred but the emit points are the natural hook for it later.
