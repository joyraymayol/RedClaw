# In-App Notifications — Manual QA Guide

Manual walkthrough covering everything shipped across Phases 1–5 of the
in-app notifications initiative (see `redclaw-notifications-plan.md`).
All test accounts share the password `AssetQA-2026!`.

## Test accounts

| Email | Role |
|---|---|
| `admin.test@example.com` | ADMIN |
| `requester.test@example.com` | REQUESTER |
| `tech.test@example.com` | TECHNICIAN (Tommy) |
| `tech2.test@example.com` | TECHNICIAN (Tina) |
| `tech3.test@example.com` | TECHNICIAN (Theo) |
| `supervisor.test@example.com` | SUPERVISOR |
| `maint.head.test@example.com` | HEAD, Maintenance |
| `maint.sup.test@example.com` | SUPERVISOR, Maintenance |
| `qa.sup.test@example.com` | SUPERVISOR, Quality Assurance |
| `prod.staff.test@example.com` | REQUESTER, Production (prepares plans) |
| `prod.head.test@example.com` | HEAD, Production (designated plan approver) |

## Bell basics

- [ ] Log in as any account with existing notifications — badge count shows on the bell without opening it.
- [ ] Open the dropdown — recent items load, unread ones have a dot and bold title.
- [ ] Click an item — it navigates to the linked ticket/plan and the dot disappears.
- [ ] Click "Mark all read" in the dropdown — badge clears to zero.
- [ ] Take any action yourself (e.g. resolve your own ticket) — confirm you never get notified about your own action.

## Ticket assignment

- [ ] As admin, assign a ticket to a technician — that technician's bell picks up `TICKET_ASSIGNED`.
- [ ] Use "Manage team" to remove a technician — they get `TICKET_UNASSIGNED`.
- [ ] Priority preempt: get a technician `IN_PROGRESS` on a MEDIUM ticket, then assign them a new HIGH or CRITICAL ticket — their original ticket flips to "On hold" and they get `TICKET_ON_HOLD`.

## Ticket lifecycle

- [ ] Resolve a MAINTENANCE ticket — the requester gets `TICKET_VERIFY_REQUESTED`; verify it — supervisors get `TICKET_REVIEW_REQUESTED`; close it — requester + technician get `TICKET_CLOSED`.
- [ ] Resolve a PREVENTIVE_MAINTENANCE ticket — supervisors get `TICKET_REVIEW_REQUESTED` directly (skips verification).
- [ ] Reopen a ticket, or reject a supervisor review — assignees get `TICKET_REOPENED`.
- [ ] Cancel a ticket — requester + assignees get `TICKET_CANCELLED`.
- [ ] Raise any new ticket — admins/HEAD get `TICKET_NEEDS_ASSIGNMENT`.

## Machine-Setup dual approval

- [ ] Resolve a MACHINE_SETUP ticket — maintenance leads get `SETUP_MAINTENANCE_APPROVAL`.
- [ ] Approve (Maintenance) — QA leads get `SETUP_QA_APPROVAL`.
- [ ] Approve (QA) — requester + assignees get `TICKET_CLOSED`, and the machine's current mold updates to the setup's target product.
- [ ] Reject the setup instead — assignees get `SETUP_REJECTED`.

## Production plans

- [ ] As `prod.staff`, submit a DRAFT plan — `prod.head` (designated approver) gets `PLAN_APPROVAL_REQUESTED`.
- [ ] Approve the plan — maintenance leads + the preparer get `PLAN_APPROVED`.
- [ ] Edit a row on an already-approved plan — maintenance leads + any open setup-ticket's assignees on that row get `PLAN_ROW_CHANGED`. (Editing a *draft* row shouldn't notify anyone.)

## `/notifications` page

- [ ] Click "See all" at the bottom of the bell dropdown — lands on `/notifications`.
- [ ] Toggle "All" ↔ "Unread" — the count badge on "Unread" matches reality.
- [ ] Change rows-per-page and page Next/Previous.
- [ ] Click a row on the page itself — marks read and navigates, same as the dropdown.
- [ ] "Mark all read" from the page — badge and Unread tab both clear.
