# Factory Maintenance Ticketing App — Build Plan

Stack: Next.js (App Router) + shadcn/ui + Tailwind + Prisma + Supabase (Auth + Postgres DB)

---

## 1. Roles

| Role | Code | Can do |
|---|---|---|
| Requester (Production) | `REQUESTER` | Raise tickets, verify a fix on their machine, reopen if not fixed, cancel own ticket while still `OPEN` |
| Maintenance Technician | `TECHNICIAN` | Work one ticket at a time, log remarks, place a ticket on hold (with reason), mark ticket resolved |
| Maintenance Admin | `ADMIN` | Assign/reassign tickets, cancel mistaken/duplicate tickets, manage machines, users, problem types |
| Maintenance Supervisor | `SUPERVISOR` | Final QA sign-off, close tickets, override stuck verifications |
| Maintenance Head | `HEAD` | Everything above + reporting dashboards, knowledge-base curation |

Keep this as a single `role` enum on `User` for now (simple), with room to move to a `Role`/`Permission` join table later if you need finer-grained access.

**Authorization principle (important):** roles gate *actions*, not just pages. Every mutation re-checks role + current ticket state **on the server** through one shared `can(user, action, ticket)` helper (see §4) — hiding a button client-side is never the security boundary. This is the single most common hole in role-based apps; centralizing the check next to the state machine keeps it airtight and unit-testable.

---

## 2. Ticket Lifecycle (state machine)

```
OPEN ──admin assigns──▶ ASSIGNED ──tech starts──▶ IN_PROGRESS
  │                        │                         │    ▲
  │ requester/admin        │ admin cancels           │    │
  │ cancels                │ (with note)   tech holds│    │resume
  ▼                        │               / preempt ▼    │
CANCELLED ◀────────────────┘                       ON_HOLD
 (terminal)

IN_PROGRESS ──tech marks fixed──▶ PENDING_VERIFICATION
PENDING_VERIFICATION ──requester confirms──────────────▶ PENDING_SUPERVISOR_REVIEW
PENDING_VERIFICATION ──no response in N days (auto)────▶ PENDING_SUPERVISOR_REVIEW
PENDING_VERIFICATION ──requester rejects──▶ REOPENED ──▶ ASSIGNED
PENDING_SUPERVISOR_REVIEW ──supervisor OK──────▶ CLOSED
PENDING_SUPERVISOR_REVIEW ──supervisor rejects─▶ REOPENED
```

Every transition writes a row to `TicketStatusHistory` (who, when, from→to, note). This is also how you compute "time spent per task": sum the durations the ticket actually spent in `IN_PROGRESS` (excluding `ON_HOLD` gaps).

### Cancellation
A duplicate or mistaken ticket must be able to leave the flow. `CANCELLED` is a terminal state:
- **Requester** can cancel their own ticket while it's still `OPEN`.
- **Admin** can cancel while `OPEN` or `ASSIGNED` (a required note explains why — e.g. "duplicate of TKT-2026-0339").
- Once work has started (`IN_PROGRESS` and beyond), it can't be cancelled — it has to flow through resolution so the work log stays honest.

### Holds — not just preemption
Real maintenance work pauses for more reasons than a higher-priority interrupt. `ON_HOLD` carries a `holdReason`:
- `PREEMPTED_BY_HIGHER_PRIORITY` — set by the admin preemption flow below.
- `WAITING_PARTS` / `WAITING_VENDOR` / `OTHER` — set by the **technician themself**, with a required note.

A technician-held ticket frees them to start another ticket (the 1-active rule below counts only `IN_PROGRESS`). `holdReason` is cleared on resume; the reason also lands in `TicketStatusHistory`. Time "waiting for parts" vs. "wrench time" then falls straight out of the history for reporting.

### Verification can't get stuck
If the requester never responds, a ticket would sit in `PENDING_VERIFICATION` forever. Two escape hatches:
1. **Auto-escalation:** a daily job moves tickets pending verification for more than N days (configurable, default 3) to `PENDING_SUPERVISOR_REVIEW`, logged in history as an automatic transition.
2. **Supervisor override:** a supervisor can pull a pending-verification ticket into review manually at any time.

Ageing tickets in either pending state surface on the supervisor/head dashboard so nothing rots quietly.

### Reopen routing
`REOPENED → ASSIGNED` keeps the **previous technician by default** (they have the context); admin may reassign. Each reopen increments `Ticket.reopenCount` — a cheap, high-signal metric for chronic bounce-backs per machine, problem type, or technician.

### The "1 active ticket per technician" rule
Enforce this two ways:
1. **App logic**: before setting a ticket to `IN_PROGRESS` for a technician, check they have no other ticket currently `IN_PROGRESS`.
2. **DB-level safety net** (Postgres partial unique index, since Supabase = Postgres):
```sql
CREATE UNIQUE INDEX one_active_ticket_per_tech
ON "Ticket" ("assignedTechnicianId")
WHERE status = 'IN_PROGRESS';
```
This makes it physically impossible for two tickets to be `IN_PROGRESS` under the same technician, even if two requests race each other.

### Every transition is one transaction with an optimistic guard
The partial index only protects the `IN_PROGRESS` case. For *every* transition, run the status change, the `TicketStatusHistory` insert, and any side effects (assignment rows, stock decrements) in a single Prisma `$transaction`, and guard the status change optimistically:

```ts
const { count } = await tx.ticket.updateMany({
  where: { id: ticketId, status: expectedFromStatus },  // guard
  data:  { status: toStatus, ... },
});
if (count === 0) throw new ConflictError("Ticket changed state — refresh and retry");
```

Two people acting on the same ticket at the same moment then cleanly produce one winner and one friendly conflict error instead of corrupt history.

### Priority interrupt (halt & reassign)
When admin assigns a `CRITICAL`/`HIGH` ticket to a technician who's already `IN_PROGRESS` on something else:
1. Current ticket → `ON_HOLD` with `holdReason: PREEMPTED_BY_HIGHER_PRIORITY`, history entry references the new ticket.
2. New ticket → `IN_PROGRESS`, assigned to that technician.
3. Technician's "resume" action later moves the held ticket back to `IN_PROGRESS` — but only if they have no other active ticket (same guard rule).

### Where a ticket comes from
A ticket carries a `source`: `MANUAL` (raised by a requester) or `PREVENTIVE` (auto-generated by a `MaintenanceSchedule` — see §3). Same lifecycle applies to both; PM-generated tickets just default to a system-attributed requester and a standard priority unless the schedule overrides it.

---

## 3. Database Schema (Prisma)

```prisma
enum UserRole {
  REQUESTER
  TECHNICIAN
  ADMIN
  SUPERVISOR
  HEAD
}

enum TicketStatus {
  OPEN
  ASSIGNED
  IN_PROGRESS
  ON_HOLD
  PENDING_VERIFICATION
  PENDING_SUPERVISOR_REVIEW
  REOPENED
  CLOSED
  CANCELLED
}

enum TicketPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum TicketSource {
  MANUAL       // raised by a requester
  PREVENTIVE   // auto-generated by a MaintenanceSchedule
}

enum HoldReason {
  PREEMPTED_BY_HIGHER_PRIORITY
  WAITING_PARTS
  WAITING_VENDOR
  OTHER
}

enum MachineStatus {
  OPERATIONAL
  DOWN
  UNDER_MAINTENANCE
}

enum RemarkType {
  WORK_LOG
  GENERAL
  VERIFICATION_NOTE
}

enum AssignmentReason {
  INITIAL_ASSIGN
  REASSIGNED
  PREEMPTED_BY_HIGHER_PRIORITY
  RESUMED
  REOPENED
}

enum ScheduleFrequencyType {
  TIME    // e.g. every 30 days
  USAGE   // e.g. every 500 operating hours
}

model User {
  id          String   @id @default(uuid()) // matches Supabase auth.users.id
  email       String   @unique
  name        String
  role        UserRole
  department  String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  ticketsRaised     Ticket[]              @relation("Requester")
  ticketsAssigned   Ticket[]              @relation("Technician")
  remarks           TicketRemark[]
  statusChanges     TicketStatusHistory[]
  assignmentsGiven  TicketAssignment[]    @relation("AssignedBy")
  assignmentsHeld   TicketAssignment[]    @relation("Technician")
  solutionsAuthored Solution[]
  partsLogged       TicketPart[]
  downtimeLogged    DowntimeLog[]
  usageReadings     MachineUsageLog[]
}

model Machine {
  id           String        @id @default(uuid())
  assetCode    String        @unique   // e.g. "CNC-014"
  name         String
  category     String?                 // e.g. "CNC", "Conveyor", "Compressor"
  location     String?
  status       MachineStatus @default(OPERATIONAL)
  purchaseDate DateTime?
  notes        String?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  tickets      Ticket[]
  schedules    MaintenanceSchedule[]
  downtimeLogs DowntimeLog[]
  usageLogs    MachineUsageLog[]
}

// Cumulative operating-hours readings — the data source for USAGE-based PM
// schedules. Manual entry to start (a small form on the machine page);
// swap in automated meter feeds later without touching the schema.
model MachineUsageLog {
  id           String   @id @default(uuid())
  machineId    String
  hoursReading Int      // cumulative hours on the machine's meter at reading time
  recordedById String
  recordedAt   DateTime @default(now())

  machine    Machine @relation(fields: [machineId], references: [id])
  recordedBy User    @relation(fields: [recordedById], references: [id])

  @@index([machineId, recordedAt])
}

model ProblemType {
  id          String   @id @default(uuid())
  name        String   @unique   // e.g. "Motor overheating", "Belt slippage"
  category    String?
  description String?

  tickets   Ticket[]
  solutions Solution[]
}

// Knowledge base: curated fixes for a problem type (optionally scoped to one machine)
model Solution {
  id             String   @id @default(uuid())
  problemTypeId  String
  machineId      String?           // null = applies generally, set = machine-specific
  title          String
  description    String
  authorId       String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  problemType ProblemType @relation(fields: [problemTypeId], references: [id])
  author      User        @relation(fields: [authorId], references: [id])
  tickets     Ticket[]    // tickets created referencing this suggested solution
}

// Defines the SLA targets per priority — the source that fills in
// Ticket.ackDueAt / resolveDueAt at creation time. Editable by ADMIN/HEAD.
// e.g. CRITICAL: ack 15 min / resolve 4 h ... LOW: ack 8 h / resolve 5 days.
// (Business-hours calendars are a future refinement — clock time is fine to start.)
model SlaPolicy {
  id             String         @id @default(uuid())
  priority       TicketPriority @unique
  ackMinutes     Int            // must be ASSIGNED within this
  resolveMinutes Int            // must reach PENDING_VERIFICATION within this
  updatedAt      DateTime       @updatedAt
}

model Ticket {
  id                   String         @id @default(uuid())
  ticketNumber         String         @unique   // e.g. "TKT-2026-0341" — see note below
  title                String
  description          String
  machineId            String
  requesterId          String
  problemTypeId        String?
  suggestedSolutionId  String?        // picked at creation time, if applicable
  priority             TicketPriority @default(MEDIUM)
  status               TicketStatus   @default(OPEN)
  assignedTechnicianId String?
  source               TicketSource   @default(MANUAL)
  scheduleId           String?        // set if source = PREVENTIVE
  holdReason           HoldReason?    // set while ON_HOLD, cleared on resume
  reopenCount          Int            @default(0)

  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  ackDueAt     DateTime? // SLA target: must be assigned by this time (from SlaPolicy)
  resolveDueAt DateTime? // SLA target: must be resolved by this time (from SlaPolicy)
  slaBreached  Boolean   @default(false)
  startedAt    DateTime? // first time it entered IN_PROGRESS
  resolvedAt   DateTime? // tech marked done
  verifiedAt   DateTime? // requester confirmed
  closedAt     DateTime? // supervisor closed
  cancelledAt  DateTime?

  machine           Machine              @relation(fields: [machineId], references: [id])
  requester         User                 @relation("Requester", fields: [requesterId], references: [id])
  technician        User?                @relation("Technician", fields: [assignedTechnicianId], references: [id])
  problemType       ProblemType?         @relation(fields: [problemTypeId], references: [id])
  suggestedSolution Solution?            @relation(fields: [suggestedSolutionId], references: [id])
  schedule          MaintenanceSchedule? @relation(fields: [scheduleId], references: [id])

  remarks       TicketRemark[]
  attachments   TicketAttachment[]
  statusHistory TicketStatusHistory[]
  assignments   TicketAssignment[]
  partsUsed     TicketPart[]
  downtimeLogs  DowntimeLog[]

  @@index([status])
  @@index([status, priority])
  @@index([machineId])
  @@index([assignedTechnicianId])
  @@index([createdAt])
}

// Audit trail — also the source of truth for "time spent" reporting
model TicketStatusHistory {
  id          String        @id @default(uuid())
  ticketId    String
  fromStatus  TicketStatus?
  toStatus    TicketStatus
  changedById String
  note        String?
  createdAt   DateTime      @default(now())

  ticket    Ticket @relation(fields: [ticketId], references: [id])
  changedBy User   @relation(fields: [changedById], references: [id])

  @@index([ticketId])
}

// Tracks each assign/reassign/halt event separately from status
model TicketAssignment {
  id           String           @id @default(uuid())
  ticketId     String
  technicianId String
  assignedById String
  assignedAt   DateTime         @default(now())
  unassignedAt DateTime?
  reason       AssignmentReason @default(INITIAL_ASSIGN)

  ticket     Ticket @relation(fields: [ticketId], references: [id])
  technician User   @relation("Technician", fields: [technicianId], references: [id])
  assignedBy User   @relation("AssignedBy", fields: [assignedById], references: [id])

  @@index([ticketId])
  @@index([technicianId])
}

model TicketRemark {
  id        String     @id @default(uuid())
  ticketId  String
  userId    String
  body      String
  type      RemarkType @default(WORK_LOG)
  createdAt DateTime   @default(now())

  ticket      Ticket             @relation(fields: [ticketId], references: [id])
  user        User               @relation(fields: [userId], references: [id])
  attachments TicketAttachment[]

  @@index([ticketId])
}

model TicketAttachment {
  id          String   @id @default(uuid())
  ticketId    String
  remarkId    String?
  storagePath String   // path inside the PRIVATE Supabase Storage bucket — serve via short-lived signed URLs, never store a public URL
  fileName    String
  uploadedAt  DateTime @default(now())

  ticket Ticket        @relation(fields: [ticketId], references: [id])
  remark TicketRemark? @relation(fields: [remarkId], references: [id])

  @@index([ticketId])
}

// --- Added now to avoid a schema retrofit later ---

// Preventive Maintenance: recurring rule that auto-generates a Ticket when due
model MaintenanceSchedule {
  id              String   @id @default(uuid())
  machineId       String
  problemTypeId   String?           // e.g. "Scheduled lubrication"
  title           String
  frequencyType   ScheduleFrequencyType
  intervalDays    Int?               // used when frequencyType = TIME
  intervalUsage   Int?               // used when frequencyType = USAGE (e.g. every 500 hrs) — compared against MachineUsageLog readings
  lastGeneratedAt DateTime?
  nextDueAt       DateTime?          // computed; drives the PM job
  defaultPriority TicketPriority @default(MEDIUM)
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  machine  Machine  @relation(fields: [machineId], references: [id])
  tickets  Ticket[]           // tickets this schedule has generated
}

// Actual machine downtime — separate from ticket status so MTBF/MTTR are accurate
// even when downtime starts before a ticket exists or outlasts the fix
model DowntimeLog {
  id         String    @id @default(uuid())
  machineId  String
  ticketId   String?             // linked once a ticket is raised for it
  startedAt  DateTime
  endedAt    DateTime?
  reason     String?
  loggedById String

  machine  Machine @relation(fields: [machineId], references: [id])
  ticket   Ticket? @relation(fields: [ticketId], references: [id])
  loggedBy User    @relation(fields: [loggedById], references: [id])

  @@index([machineId])
}

// Spare parts inventory
model Part {
  id             String   @id @default(uuid())
  sku            String   @unique
  name           String
  unit           String   @default("pcs")   // pcs, liters, meters, etc.
  quantityOnHand Int      @default(0)
  reorderLevel   Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  usages TicketPart[]
}

// Parts consumed on a specific ticket (technician logs this while resolving)
model TicketPart {
  id           String   @id @default(uuid())
  ticketId     String
  partId       String
  quantityUsed Int
  loggedById   String
  loggedAt     DateTime @default(now())

  ticket   Ticket @relation(fields: [ticketId], references: [id])
  part     Part   @relation(fields: [partId], references: [id])
  loggedBy User   @relation(fields: [loggedById], references: [id])

  @@index([ticketId])
  @@index([partId])
}
```

**Ticket number generation:** don't compute `max + 1` in app code — two simultaneous creates will race. Use a Postgres sequence (created in a migration: `CREATE SEQUENCE ticket_seq`) and format `TKT-{YYYY}-{nextval}` at insert time inside the create transaction. If you want the counter to reset each year, keep a tiny `(year, counter)` table updated with `INSERT ... ON CONFLICT ... DO UPDATE SET counter = counter + 1 RETURNING counter` — atomic either way.

**Inventory decrement safety:** logging a `TicketPart` must decrement `Part.quantityOnHand` **in the same transaction**, with a conditional update so stock can't go negative under concurrency:

```ts
const { count } = await tx.part.updateMany({
  where: { id: partId, quantityOnHand: { gte: quantityUsed } },
  data:  { quantityOnHand: { decrement: quantityUsed } },
});
if (count === 0) throw new ConflictError("Not enough stock on hand");
```

**Reporting queries this unlocks:**
- Time-in-progress per ticket = sum of gaps between `IN_PROGRESS` and the next status change, pulled from `TicketStatusHistory`.
- Waiting-for-parts time = same technique over `ON_HOLD` gaps with `holdReason = WAITING_PARTS`.
- Tickets per machine, mean-time-to-repair per machine/problem type, technician workload/closure rate, reopen rate — all derivable from `Ticket` + `TicketStatusHistory` + `TicketAssignment`.
- **MTTR** (mean time to repair) = average `DowntimeLog` duration per machine.
- **MTBF** (mean time between failures) = average gap between consecutive `DowntimeLog.startedAt` values per machine.
- **PM compliance** = % of `MaintenanceSchedule` rows whose generated ticket closed before the next `nextDueAt`.
- **SLA compliance** = % of tickets where `slaBreached = false`, filterable by priority/technician/date range.
- **Parts consumption** = `TicketPart` grouped by `Part`, surfaces reorder candidates against `reorderLevel`.

Why these were added to the schema now instead of later: `MaintenanceSchedule`, `MachineUsageLog`, `DowntimeLog`, `Part`/`TicketPart`, `SlaPolicy`, and the SLA fields on `Ticket` all sit at the center of the data model — other tables (`Ticket`, `Machine`) need to reference them directly, and PM/SLA logic reads them. Bolting them on after you have real production data means backfilling foreign keys and migrating existing rows, which is riskier than just shipping the columns/tables now even if the UI for them comes later.

---

## 4. Suggested Folder Structure

Mutations use **Server Actions** (the modern App Router idiom — less boilerplate, progressive enhancement, typed end-to-end). Route handlers remain only where a real HTTP surface is needed: cron triggers, future webhooks, and file exports.

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── layout.tsx
│
├── (app)/                          # authenticated shell
│   ├── layout.tsx                  # sidebar/nav, role-aware
│   │
│   ├── dashboard/page.tsx          # role-aware landing (KPIs, ageing-ticket alerts)
│   │
│   ├── tickets/
│   │   ├── page.tsx                # data table: list/filter/search (server-side pagination)
│   │   ├── new/page.tsx            # new ticket form (requester)
│   │   └── [ticketId]/page.tsx     # ticket detail: timeline, remarks, actions
│   │
│   ├── machines/
│   │   ├── page.tsx                # machine list
│   │   └── [machineId]/page.tsx    # machine profile + ticket history + usage-hours entry
│   │
│   ├── knowledge-base/
│   │   ├── page.tsx                # list problem types + solutions
│   │   └── [problemTypeId]/page.tsx
│   │
│   ├── schedules/
│   │   ├── page.tsx                # PM schedule list (calendar/table view)
│   │   └── new/page.tsx            # create a recurring PM rule
│   │
│   ├── inventory/
│   │   └── page.tsx                # parts list, stock levels, reorder flags
│   │
│   ├── reports/
│   │   ├── page.tsx                # overview
│   │   ├── time-spent/page.tsx     # time-per-task report
│   │   ├── technician-load/page.tsx
│   │   └── downtime/page.tsx       # MTBF/MTTR per machine
│   │
│   └── admin/
│       ├── users/page.tsx
│       └── settings/page.tsx       # incl. SLA policy editor, verification timeout
│
├── api/                            # route handlers ONLY where HTTP is required
│   └── cron/
│       ├── generate-pm-tickets/route.ts   # daily: create tickets for due schedules
│       └── check-sla-and-escalate/route.ts # daily: flag SLA breaches, auto-escalate stale verifications
│
components/
├── ui/                             # shadcn primitives (button, input, etc.)
├── tickets/
│   ├── ticket-form.tsx             # new ticket form
│   ├── ticket-status-badge.tsx
│   ├── ticket-timeline.tsx
│   ├── ticket-data-table.tsx       # tanstack-table + shadcn table (manual/server-side mode)
│   ├── ticket-data-table-toolbar.tsx  # column filters, search
│   └── remark-thread.tsx
├── machines/
│   └── machine-picker.tsx
├── reports/
│   └── time-spent-table.tsx
└── layout/
    ├── app-sidebar.tsx
    └── role-gate.tsx               # conditionally render by role (UX only — never the security boundary)

lib/
├── supabase/
│   ├── client.ts                   # browser client
│   ├── server.ts                   # server client (RSC/route handlers)
│   └── middleware.ts               # session refresh
├── prisma.ts                       # Prisma client singleton
├── env.ts                          # zod-validated process.env — fail fast at boot
├── auth.ts                         # getCurrentUser(), role helpers
├── authz.ts                        # can(user, action, ticket) — THE authorization check
├── ticket-state-machine.ts         # allowed transitions + guard logic (pure functions, unit-tested)
├── ticket-number.ts                # sequence-backed ticket number generator
├── actions/                        # Server Actions ("use server") — every mutation calls can() first
│   ├── tickets.ts                  # createTicket, assignTicket, startWork, holdTicket,
│   │                               # resumeTicket, resolveTicket, verifyTicket, closeTicket,
│   │                               # cancelTicket, reopenTicket, addRemark, logPartUsed
│   ├── machines.ts                 # machine CRUD, recordUsageReading, start/stopDowntime
│   ├── solutions.ts
│   ├── schedules.ts
│   ├── inventory.ts
│   └── admin.ts                    # user management, SLA policy
├── validations/
│   └── ticket.ts                   # zod schemas (shared by forms and actions)
└── utils.ts

prisma/
├── schema.prisma
├── migrations/
└── seed.ts                         # roles, sample machines, problem types, SLA defaults

middleware.ts                        # session presence only — authorization lives in authz.ts
```

**Auth notes:**
- Use Supabase Auth for login/session; mirror `auth.users.id` into your Prisma `User.id` (uuid) **via a Postgres trigger on `auth.users`** so the mirror row is created the moment a user signs up — a client that never calls a sync endpoint can't skip it. (An API-side sync call is an acceptable fallback, but the trigger is the primary path.)
- Supabase Row Level Security (RLS) is optional here since you're going through Prisma with a server-side service role — but if you ever query Supabase directly from the client, turn RLS on and mirror the same role checks. The **service-role key must never reach the client** — it lives only in server env (`lib/env.ts` enforces this by keeping it out of `NEXT_PUBLIC_*`).

**Storage rules:** attachments go in a **private** bucket. Validate file size and MIME type on upload (photos + PDFs, sensible cap like 10 MB), store only the bucket path (`TicketAttachment.storagePath`), and serve through short-lived signed URLs generated server-side. Fault photos of your factory floor should not be permanently reachable by anyone holding an old URL.

**Cron endpoints must be protected and idempotent:** `api/cron/*` routes are hit by a scheduled job (Vercel Cron or Supabase `pg_cron` + `pg_net`) once a day. Each one:
1. Rejects requests without the shared secret header (`CRON_SECRET`) — otherwise anyone who finds the URL can spam PM tickets.
2. Is idempotent — `generate-pm-tickets` only creates a ticket for a schedule if none has been generated for the current `nextDueAt` (check `lastGeneratedAt` inside the same transaction that advances it), so a double-fired cron can't create duplicates.

Usage-based schedules (`intervalUsage`) read the latest `MachineUsageLog` reading to decide when they're due — manual meter entry on the machine page is fine to start.

**Timezones:** store everything UTC (Postgres `timestamptz` — Prisma's default), render in the factory's local timezone. This matters for SLA due-time math and shift-boundary reporting; decide the display timezone once (a config value) rather than trusting each browser.

---

## 5. Example: New Ticket Form (Requester)

Built with `react-hook-form` + `zod` + shadcn `Form` components.

**Fields:**
| Field | Component | Notes |
|---|---|---|
| Machine / Asset | `Combobox` (searchable select) | Pulls from `Machine`, shows assetCode + name |
| Problem Type | `Select` | Pulls from `ProblemType`; on change, fetch matching `Solution`s |
| Suggested Solution (optional) | `Select` / cards | Only shown if solutions exist for the chosen Problem Type (+ bonus match if scoped to the selected machine); requester can pick one as a hint for the technician, not mandatory |
| Priority | `Select` | LOW / MEDIUM / HIGH / CRITICAL — requester can suggest, admin can override on assignment |
| Title | `Input` | Short summary |
| Description | `Textarea` | What happened, when noticed, symptoms |
| Attachments | file upload → Supabase Storage (private bucket) | Photos of the fault; validated size/type, stored as bucket paths |

```tsx
// lib/validations/ticket.ts
import { z } from "zod";

export const newTicketSchema = z.object({
  machineId: z.string().uuid("Select a machine"),
  problemTypeId: z.string().uuid().optional(),
  suggestedSolutionId: z.string().uuid().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  title: z.string().min(5, "Give a short summary").max(120),
  description: z.string().min(10, "Add a bit more detail"),
  attachments: z.array(z.string()).optional(), // storage paths in the private bucket, not URLs
});

export type NewTicketInput = z.infer<typeof newTicketSchema>;
```

```tsx
// components/tickets/ticket-form.tsx (structure sketch)
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
    <FormField name="machineId" render={...} />       {/* Combobox */}
    <FormField name="problemTypeId" render={...} />   {/* Select, triggers solution fetch */}

    {solutions.length > 0 && (
      <FormField name="suggestedSolutionId" render={...} />  {/* optional, shown conditionally */}
    )}

    <div className="grid grid-cols-2 gap-4">
      <FormField name="priority" render={...} />
      <FormField name="title" render={...} />
    </div>

    <FormField name="description" render={...} />     {/* Textarea */}
    <FormField name="attachments" render={...} />      {/* Dropzone upload */}

    <Button type="submit">Submit Ticket</Button>
  </form>
</Form>
```

On submit → `createTicket` server action → re-validates with the same zod schema, checks `can()`, then in one transaction: creates the `Ticket` with `status: OPEN` and a sequence-backed `ticketNumber`, stamps `ackDueAt`/`resolveDueAt` from the matching `SlaPolicy`, writes the first `TicketStatusHistory` row (`fromStatus: null → OPEN`), and notifies admins (in-app).

---

## 6. Reporting Views (for Maintenance Head)

- **Ticket history table** (`/tickets`): tanstack-table + shadcn — sortable columns (machine, priority, status, technician, created/closed date), per-column filters, global search, status/priority badges, **server-side pagination** (this table grows without bound — never ship it client-paginated).
- **Time-spent report** (`/reports/time-spent`): one row per closed ticket — total open→close duration, actual "wrench time" (`IN_PROGRESS` only), and waiting-on-parts time, grouped/filterable by machine, technician, problem type, date range.
- **Downtime report** (`/reports/downtime`): MTBF/MTTR per machine, sourced from `DowntimeLog`.
- **Machine detail page** (`/machines/[id]`): all tickets for that asset, MTBF/MTTR stats, reopen counts, current usage-hours reading + entry form, upcoming `MaintenanceSchedule` items, and a shortcut to add a `Solution` entry for a recurring problem type straight from that context.
- **Inventory view** (`/inventory`): parts below `reorderLevel`, and per-part usage history via `TicketPart`.

---

## 7. Build Order (phased)

### Phase 0 — Foundation
Everything here is cheap now and expensive to retrofit.
1. Scaffold: Next.js + Tailwind + shadcn/ui, Prisma + Supabase wiring, `lib/env.ts` zod-validated env.
2. Auth: Supabase login, `auth.users` → `User` mirror trigger, `getCurrentUser()`.
3. Role-aware app shell (sidebar, `role-gate`), plus `authz.ts` `can()` skeleton.
4. Initial migration + `seed.ts` (users per role, machines, problem types, SLA defaults).
5. CI (GitHub Actions): lint + typecheck + unit tests on every push; `prisma migrate diff` check so schema drift fails loudly.

### Phase 1 — Core ticket flow (MVP)
6. `Machine`, `ProblemType`, `Solution` CRUD (admin).
7. New ticket form + ticket list (server-side pagination) + ticket detail page.
8. State machine + `can()` **with unit tests** — write these before wiring the actions; they're pure functions and the highest-value tests in the app.
9. Assignment flow (admin assigns, 1-active-ticket guard, partial unique index migration).
10. Technician actions: start / hold (with reason) / resume / resolve + remarks.
11. Requester verification + supervisor close-out + **cancel flow**.
12. **Minimal in-app notifications** (unread badge + list, written on assignment/preemption/resolution/reopen). Moved up from "later": if a technician doesn't find out they've been assigned, the whole loop silently breaks. Email can wait; a badge can't.

### Phase 2 — Operational depth
13. `Part`/`TicketPart` — technician logs parts on resolve, transactional stock decrement.
14. `DowntimeLog` — start/stop downtime tied to a machine (and optionally a ticket); MTBF/MTTR report.
15. `MachineUsageLog` entry form + `MaintenanceSchedule` CRUD + the daily `generate-pm-tickets` cron (secret-protected, idempotent).
16. SLA: `SlaPolicy` admin editor, due-time stamping on create/assign, daily `check-sla-and-escalate` cron (breach flagging + stale-verification auto-escalation).

### Phase 3 — Insight & polish
17. Full reports suite (time-spent, technician load, downtime) + CSV export.
18. Email notifications (Resend or similar) layered on the same notification events.
19. Knowledge-base curation flow (HEAD promotes good ticket resolutions into `Solution`s).
20. One Playwright end-to-end happy path: raise → assign → start → resolve → verify → close.

Phases 0–1 are the usable MVP. Phase 2 is the "add now, not later" batch — worth doing before real production data accumulates, since all of it touches the schema (which is why those tables ship in §3 from day one even though their UI lands here).

---

## 8. Engineering Practices

Small app or not, these are the practices that keep it correct as it grows:

- **Testing (Vitest + Playwright):**
  - *Unit*: `ticket-state-machine.ts` and `authz.ts` — every allowed/forbidden transition per role. Pure functions, fast, and they encode the entire business core of this app.
  - *Integration*: the race-prone server actions (assign, start, logPartUsed) against a real test database — assert the optimistic guard and the partial unique index actually reject the loser.
  - *E2E*: one Playwright happy path (Phase 3, step 20). Don't gold-plate beyond that until the app is live.
- **Migrations:** `prisma migrate dev` locally, `prisma migrate deploy` in CI/deploy — never `db push` against shared environments. Raw-SQL migrations carry the partial unique index, the ticket-number sequence, and the auth mirror trigger.
- **Seed data:** `prisma/seed.ts` gives every developer a login per role and enough machines/problem types to click through the whole flow in under a minute.
- **Env & secrets:** `lib/env.ts` parses `process.env` with zod at boot and fails fast on anything missing. Service-role key and `CRON_SECRET` are server-only.
- **Error handling:** server actions return a consistent `{ ok, error? }` shape; `ConflictError` (stale state, stock shortfall) renders as a friendly "refresh and retry" toast, not a 500. Log every *rejected* transition (actor, ticket, attempted action) — that log is your intrusion/misuse signal.
- **Logging:** structured server-side logs (even just `console` with JSON in Vercel) around transitions and cron runs; a cron that silently stops firing is how PM compliance quietly dies.

---

## 9. Pending Features (documented for later — not blocking, low retrofit risk)

These came up in scoping but don't need to be baked into the schema now — they can be added later as self-contained modules without forcing a migration of existing ticket/machine data. Revisit this list once Phases 0–2 are live.

| Feature | What it needs | Why it's safe to defer |
|---|---|---|
| **Failure coding (Problem → Cause → Remedy)** ⭐ | `CauseCode` + `RemedyCode` tables, two nullable FKs on `Ticket` set at resolution | The single most valuable future addition — the standard CMMS pattern that turns closed tickets into an analyzable failure history and auto-feeds the knowledge base. Nullable FKs = no migration pain, but plan the resolution-form UX for it |
| **QR/barcode per machine** | One field on `Machine` (`qrCodeValue`) + a scan-to-open route | Pure addition, no relation changes, no data migration |
| **Email/push notifications (rich)** | Resend/Novu hooked into the same events the Phase-1 in-app notifications already write | In-app minimal ships in MVP (Phase 1 step 12); richer channels bolt onto the same event stream |
| **Escalation rules** | Config table (e.g. "SLA breach on CRITICAL → notify HEAD", "reopenCount ≥ 2 → flag chronic") evaluated by the existing daily cron | Reads fields that already exist (`slaBreached`, `reopenCount`); pure addition |
| **Machine documents** | `MachineDocument` table (storagePath, type: manual/schematic/photo) on the machine profile | Bolt-on table; reuses the private-bucket + signed-URL pattern |
| **Labor cost tracking** | `hourlyRate` on `User` × wrench time from `TicketStatusHistory` → cost per ticket/machine in reports | One nullable column + reporting-layer math |
| **Vendor/contractor work orders** | `Vendor` table + external work-order flow (a ticket state or parallel entity) | Independent module; `WAITING_VENDOR` hold reason already marks where it plugs in |
| **Shift handover notes** | `HandoverNote` table (shift, author, body) surfaced on the technician dashboard | Fully independent of ticket/machine schema |
| **Report exports (CSV/PDF)** | Export route handlers over existing report queries | No schema change; CSV lands in Phase 3 step 17, PDF later |
| **Realtime dashboard updates** | Supabase Realtime subscription on `Ticket` changes for the admin/head dashboard | Frontend concern; polling is fine until it isn't |
| **Pareto / chronic-failure analytics** | Query layer: top problem types by count and by downtime, worst machines by reopen rate | Pure reporting over existing tables |
| **Technician skill tags** | `Skill` model + `User`↔`Skill` join table, used to filter the assignment picker | Additive join table; doesn't touch `Ticket`/`Machine` |
| **SOPs / repair checklists** | `ChecklistTemplate` linked to `ProblemType`, `ChecklistItem`, and a `TicketChecklistResult` per ticket | Independent of the core ticket flow; can attach after the fact |
| **Machine hierarchy (parent/child assets)** | Nullable self-relation `parentId` on `Machine` | One nullable FK — trivial to add whenever, existing rows just default to `null` |
| **Requester satisfaction rating** | Nullable `rating Int?` on `Ticket`, set at verification step | Single nullable column, no relation impact |
| **Downtime cost estimate** | `costPerHourDowntime` on `Machine`, multiplied against `DowntimeLog` duration in reports | Reporting-layer only once `DowntimeLog` exists (already in schema) |
| **Duplicate ticket detection** | Query logic only (same machine + problem type opened within X hours) → warn on the new-ticket form | No schema change at all; pairs with the `CANCELLED` state |
| **Business-hours SLA calendars** | Working-hours/shift calendar table; SLA math counts only working time | `SlaPolicy` already isolates the math in one place to swap |
| **Audit log export (compliance/ISO)** | Export job over existing `TicketStatusHistory`/`TicketAssignment` | No schema change; just an export endpoint |
| **Ticket category (Breakdown/Inspection/Safety)** | Enum on `Ticket`, or reuse `ProblemType.category` | Cheap enum addition whenever you're ready to formalize it |
| **Purchase-approval workflow** | `PurchaseRequest` linked to `TicketPart`/`Part`, approval states | Bigger, but bolts onto the existing `Part`/`TicketPart` tables cleanly |
| **Mobile PWA with offline support** | Service worker, local queue for remarks/status changes made offline | Frontend/infra concern, not a data-model concern |
| **Multi-plant / multi-site support** | `Site` model, `siteId` on `Machine` and `User` | Straightforward to add later; only matters once you actually expand sites |
| **ERP integration (parts ordering, depreciation)** | External API sync layer against `Part`/`Machine` | Depends on which ERP; design once that's chosen |

**Rule of thumb used to sort these:** if a feature needs a new *required* relation on `Ticket` or `Machine` (i.e. other core tables would need to know about it), it went into the schema now (§3, Phase 2). If it's a bolt-on table, a nullable column, or pure query/reporting logic, it's safe to sit in this backlog until you're ready for it.
