import {
  HoldReason,
  TicketStatus,
  TicketType,
} from "@/generated/prisma/enums";

/**
 * The ticket lifecycle as data (plan §2). Pure — no I/O, no Prisma client —
 * so every allowed/forbidden transition is unit-testable.
 *
 * WHO may perform an action lives in authz.ts `can()`; this module only
 * answers whether the ticket's current status permits it. Server Actions
 * must additionally run the transition itself with the optimistic guard
 * (`updateMany({ where: { id, status: from } })`) inside one transaction —
 * this map is not a substitute for that.
 */

export type TicketTransitionAction =
  | "assignTicket" // admin assigns a team (OPEN) or routes a reopened ticket back (REOPENED)
  | "startWork" // technician begins (subject to the 1-active-ticket guard)
  | "holdTicket" // technician pauses with a reason, or admin preempts
  | "resumeTicket" // technician picks a held ticket back up (1-active guard again)
  | "resolveTicket" // technician marks the fix/work done (target depends on ticket type)
  | "verifyTicket" // requester confirms the fix on their machine (MAINTENANCE only)
  | "reopenTicket" // requester rejects the fix (MAINTENANCE only)
  | "escalateVerification" // supervisor override or the daily stale-verification job
  | "closeTicket" // supervisor final sign-off (MAINTENANCE / PREVENTIVE_MAINTENANCE)
  | "rejectReview" // supervisor bounces it back to the technician
  | "cancelTicket" // requester (own, OPEN) or admin (OPEN/ASSIGNED, with note)
  | "approveSetupMaintenance" // MACHINE_SETUP: Maintenance head/supervisor sign-off
  | "approveSetupQa" // MACHINE_SETUP: QA head/supervisor sign-off → closes
  | "rejectSetup"; // MACHINE_SETUP: either approver bounces it back to the technician

type TransitionRule = {
  from: readonly TicketStatus[];
  to: TicketStatus;
};

export const TICKET_TRANSITIONS: Record<TicketTransitionAction, TransitionRule> = {
  assignTicket: { from: [TicketStatus.OPEN, TicketStatus.REOPENED], to: TicketStatus.ASSIGNED },
  startWork: { from: [TicketStatus.ASSIGNED], to: TicketStatus.IN_PROGRESS },
  holdTicket: { from: [TicketStatus.IN_PROGRESS], to: TicketStatus.ON_HOLD },
  resumeTicket: { from: [TicketStatus.ON_HOLD], to: TicketStatus.IN_PROGRESS },
  // `to` here is the MAINTENANCE default; the real target is type-aware —
  // see RESOLVE_TARGET / transitionTarget(). `from` is the same for all types.
  resolveTicket: { from: [TicketStatus.IN_PROGRESS], to: TicketStatus.PENDING_VERIFICATION },
  verifyTicket: {
    from: [TicketStatus.PENDING_VERIFICATION],
    to: TicketStatus.PENDING_SUPERVISOR_REVIEW,
  },
  reopenTicket: { from: [TicketStatus.PENDING_VERIFICATION], to: TicketStatus.REOPENED },
  escalateVerification: {
    from: [TicketStatus.PENDING_VERIFICATION],
    to: TicketStatus.PENDING_SUPERVISOR_REVIEW,
  },
  closeTicket: { from: [TicketStatus.PENDING_SUPERVISOR_REVIEW], to: TicketStatus.CLOSED },
  rejectReview: { from: [TicketStatus.PENDING_SUPERVISOR_REVIEW], to: TicketStatus.REOPENED },
  cancelTicket: { from: [TicketStatus.OPEN, TicketStatus.ASSIGNED], to: TicketStatus.CANCELLED },
  approveSetupMaintenance: {
    from: [TicketStatus.PENDING_MAINTENANCE_APPROVAL],
    to: TicketStatus.PENDING_QA_APPROVAL,
  },
  approveSetupQa: {
    from: [TicketStatus.PENDING_QA_APPROVAL],
    to: TicketStatus.CLOSED,
  },
  rejectSetup: {
    from: [TicketStatus.PENDING_MAINTENANCE_APPROVAL, TicketStatus.PENDING_QA_APPROVAL],
    to: TicketStatus.REOPENED,
  },
};

/**
 * `resolveTicket` lands in a different status per ticket type:
 *   - MAINTENANCE           → requester verification
 *   - PREVENTIVE_MAINTENANCE → straight to supervisor review (no external requester)
 *   - MACHINE_SETUP          → Maintenance approval, then QA (two-gate)
 */
const RESOLVE_TARGET: Record<TicketType, TicketStatus> = {
  [TicketType.MAINTENANCE]: TicketStatus.PENDING_VERIFICATION,
  [TicketType.PREVENTIVE_MAINTENANCE]: TicketStatus.PENDING_SUPERVISOR_REVIEW,
  [TicketType.MACHINE_SETUP]: TicketStatus.PENDING_MAINTENANCE_APPROVAL,
};

/** Once work has started, a ticket can never be cancelled — and nothing leaves these. */
export const TERMINAL_STATUSES: readonly TicketStatus[] = [
  TicketStatus.CLOSED,
  TicketStatus.CANCELLED,
];

/** Hold reasons a technician may set themself; PREEMPTED_BY_HIGHER_PRIORITY is reserved for the admin preemption flow. */
export const TECHNICIAN_HOLD_REASONS: readonly HoldReason[] = [
  HoldReason.WAITING_PARTS,
  HoldReason.WAITING_VENDOR,
  HoldReason.OTHER,
];

export function isTerminalStatus(status: TicketStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** May `action` fire while the ticket is in `from`? (Source status alone —
    which is type-independent for every action, so no type param is needed.) */
export function canTransition(action: TicketTransitionAction, from: TicketStatus): boolean {
  return TICKET_TRANSITIONS[action].from.includes(from);
}

/** The status `action` lands in. Only `resolveTicket` varies by ticket type. */
export function transitionTarget(
  action: TicketTransitionAction,
  type: TicketType = TicketType.MAINTENANCE
): TicketStatus {
  if (action === "resolveTicket") return RESOLVE_TARGET[type];
  return TICKET_TRANSITIONS[action].to;
}
