# Redclaw CMMS — In-App Notifications (phased)

## Progress log — where we left off

_Single source of truth for resuming. Rule: finish one phase, run the gate, then STOP and wait for the user's go-ahead before starting the next._

- [x] **Phase 1 — Data layer + emit plumbing** — DONE 2026-07-23. `Notification` model + `NotificationType` enum in `schema.prisma`; migration `20260723000001_notifications` applied to the shared dev DB (`migrate diff` clean); `src/lib/notifications.ts` (emit helpers + recipient resolvers + read helpers); `src/lib/actions/notifications.ts` (mark-read + poll actions); `src/lib/notifications.test.ts` (10 tests). Gate green: typecheck / lint / 242 tests / build. No emit points wired and nothing user-visible yet — that's expected.
- [ ] **Phase 2 — Bell UI + 45s poll + first event (ticket assignment)**  ← NEXT
- [ ] Phase 3 — Ticket lifecycle events (one `notify` hook in `runTransition`)
- [ ] Phase 4 — Approval + production-plan events
- [ ] Phase 5 — Full `/notifications` page + seed + full QA + gate

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
