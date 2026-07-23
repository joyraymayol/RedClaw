import type {
  AccountStatus,
  Department,
  TicketType,
  UserRole,
} from "@/generated/prisma/enums";
import { TicketStatus } from "@/generated/prisma/enums";
import {
  canTransition,
  isTerminalStatus,
  type TicketTransitionAction,
} from "@/lib/ticket-state-machine";

/**
 * THE authorization check (plan §1): roles gate actions, not pages.
 * Every Server Action mutation calls `can()` (directly or via
 * `assertCan()`) before touching the database — hiding a button
 * client-side is never the security boundary.
 *
 * Pure and I/O-free so the whole matrix is unit-testable. Checks that
 * need the database — the 1-active-ticket rule, note/reason validation —
 * stay in the actions, next to the transaction that enforces them.
 */

export type TicketAction =
  | TicketTransitionAction
  | "createTicket"
  | "updateAssignees"
  | "reflagAssets"
  | "addRemark"
  | "logPartUsed";

/** The slice of `User` authorization decisions run on. `department` gates who
    may raise which ticket type and who may approve Machine-Setup tickets. */
export type Actor = {
  id: string;
  role: UserRole | null;
  status: AccountStatus;
  department: Department | null;
};

/**
 * The slice of `Ticket` authorization decisions run on. `assigneeIds` is the
 * flat team of currently-assigned technicians (open TicketAssignment rows) —
 * there is no lead/primary; every member has full work rights.
 */
export type TicketContext = {
  status: TicketStatus;
  requesterId: string;
  assigneeIds: readonly string[];
};

function isAssignee(ticket: TicketContext, actorId: string): boolean {
  return ticket.assigneeIds.includes(actorId);
}

export type Verdict = { allowed: true } | { allowed: false; reason: string };

const allow: Verdict = { allowed: true };
const deny = (reason: string): Verdict => ({ allowed: false, reason });

/** Thrown by assertCan; actions surface it as a friendly error, not a 500. */
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

function hasRole(actor: Actor, ...roles: UserRole[]): boolean {
  return actor.role !== null && roles.includes(actor.role);
}

/** Maintenance "higher personnel": a Maintenance-dept HEAD/SUPERVISOR, or any
    ADMIN (treated as a global override). Gates PM/Machine-Setup creation and
    the Maintenance side of Machine-Setup approval. */
export function isMaintenanceHigher(actor: Actor): boolean {
  return (
    actor.role === "ADMIN" ||
    (actor.department === "MAINTENANCE" && hasRole(actor, "HEAD", "SUPERVISOR"))
  );
}

/** QA "higher personnel": a Quality-Assurance-dept HEAD/SUPERVISOR, or any
    ADMIN. Gates the QA side of Machine-Setup approval. */
export function isQaHigher(actor: Actor): boolean {
  return (
    actor.role === "ADMIN" ||
    (actor.department === "QUALITY_ASSURANCE" && hasRole(actor, "HEAD", "SUPERVISOR"))
  );
}

/**
 * Which ticket TYPES may this actor create? MAINTENANCE is open to any active
 * employee (so non-Maintenance staff can raise repairs — the only type they
 * may raise). PREVENTIVE_MAINTENANCE and MACHINE_SETUP are Maintenance-lead
 * only. Called by the createTicket action and by the new-ticket page to decide
 * which type options to render. Pure — unit-tested alongside can().
 */
export function canCreateTicketType(actor: Actor, type: TicketType): Verdict {
  if (actor.status !== "ACTIVE" || actor.role === null) {
    return deny("Account is not active");
  }
  if (type === "MAINTENANCE") return allow;
  if (isMaintenanceHigher(actor)) return allow;
  return deny("Only Maintenance leads may create this ticket type");
}

/**
 * May this actor prepare/edit Production Plans? Production-department staff of
 * any active role prepare them; ADMIN is a global override. Approval is a
 * separate gate (designated-approver-set membership, checked in the action —
 * it needs the database). Pure, so it can drive both the create page and the
 * createProductionPlan action.
 */
export function canPreparePlan(actor: Actor): boolean {
  if (actor.status !== "ACTIVE" || actor.role === null) return false;
  return actor.role === "ADMIN" || actor.department === "PRODUCTION";
}

export function can(actor: Actor, action: TicketAction, ticket?: TicketContext): Verdict {
  if (actor.status !== "ACTIVE" || actor.role === null) {
    return deny("Account is not active");
  }

  // Any approved employee can raise a ticket — no ticket context yet.
  if (action === "createTicket") return allow;

  if (!ticket) return deny(`Action ${action} requires a ticket`);

  switch (action) {
    // ── Remarks & parts (not status transitions) ────────────────────────
    case "addRemark": {
      if (isTerminalStatus(ticket.status)) {
        return deny("Ticket is closed or cancelled");
      }
      const isParticipant =
        ticket.requesterId === actor.id || isAssignee(ticket, actor.id);
      if (isParticipant || hasRole(actor, "ADMIN", "SUPERVISOR", "HEAD")) return allow;
      return deny("Only the requester, assigned technicians, or maintenance staff may comment");
    }

    case "logPartUsed": {
      if (ticket.status !== TicketStatus.IN_PROGRESS) {
        return deny("Parts can only be logged while work is in progress");
      }
      if (!isAssignee(ticket, actor.id)) {
        return deny("Only an assigned technician may log parts");
      }
      return allow;
    }

    // ── Admin lifecycle actions ─────────────────────────────────────────
    case "assignTicket": {
      if (!hasRole(actor, "ADMIN", "HEAD")) return deny("Only admins may assign tickets");
      break;
    }

    // Membership edit, not a status transition — must return directly so it
    // never falls through to the transition-map check below, which has no
    // entry for this action.
    case "updateAssignees": {
      if (!hasRole(actor, "ADMIN", "HEAD")) return deny("Only admins may change assignees");
      const editable: TicketStatus[] = [
        TicketStatus.ASSIGNED,
        TicketStatus.IN_PROGRESS,
        TicketStatus.ON_HOLD,
      ];
      if (!editable.includes(ticket.status)) {
        return deny("Members can only be changed while the ticket is assigned or being worked");
      }
      return allow;
    }

    // Non-transition action, like updateAssignees — must return directly so
    // it never falls through to the transition-map check below, which has
    // no entry for this action.
    case "reflagAssets": {
      const eligible = hasRole(actor, "ADMIN", "HEAD") || isAssignee(ticket, actor.id);
      if (!eligible) {
        return deny("Only admins, head, or an assigned technician may re-flag assets");
      }
      if (isTerminalStatus(ticket.status)) {
        return deny("Ticket is closed or cancelled");
      }
      return allow;
    }

    case "cancelTicket": {
      // Requesters may withdraw their own ticket, but only while it's
      // still OPEN; admins may also cancel after assignment (with a note,
      // enforced by the action's input schema).
      const isOwnRequest = ticket.requesterId === actor.id;
      const isAdmin = hasRole(actor, "ADMIN", "HEAD");
      if (!isAdmin && !(isOwnRequest && ticket.status === TicketStatus.OPEN)) {
        return deny("Only the requester (while open) or an admin may cancel");
      }
      break;
    }

    // ── Technician actions — any assigned team member, equal rights ─────
    case "startWork":
    case "holdTicket":
    case "resumeTicket":
    case "resolveTicket": {
      if (!isAssignee(ticket, actor.id)) {
        return deny("Only an assigned technician may work this ticket");
      }
      break;
    }

    // ── Requester verification — bound to the ticket's requester ────────
    case "verifyTicket":
    case "reopenTicket": {
      if (ticket.requesterId !== actor.id) {
        return deny("Only the requester may verify or reject the fix");
      }
      break;
    }

    // ── Supervisor QA ────────────────────────────────────────────────────
    case "escalateVerification":
    case "closeTicket":
    case "rejectReview": {
      if (!hasRole(actor, "SUPERVISOR", "HEAD")) {
        return deny("Only supervisors may review and close tickets");
      }
      break;
    }

    // ── Machine-Setup dual approval (sequential: Maintenance → QA) ────────
    case "approveSetupMaintenance": {
      if (!isMaintenanceHigher(actor)) {
        return deny("Only a Maintenance lead may approve a machine setup");
      }
      break;
    }
    case "approveSetupQa": {
      if (!isQaHigher(actor)) {
        return deny("Only a QA lead may approve a machine setup");
      }
      break;
    }
    case "rejectSetup": {
      const stageOk =
        (ticket.status === TicketStatus.PENDING_MAINTENANCE_APPROVAL &&
          isMaintenanceHigher(actor)) ||
        (ticket.status === TicketStatus.PENDING_QA_APPROVAL && isQaHigher(actor));
      if (!stageOk) {
        return deny("Only the current approver may reject this machine setup");
      }
      break;
    }
  }

  if (!canTransition(action, ticket.status)) {
    return deny(`Cannot ${action} a ticket that is ${ticket.status}`);
  }
  return allow;
}

/** `can()` that throws — for the top of Server Actions. */
export function assertCan(actor: Actor, action: TicketAction, ticket?: TicketContext): void {
  const verdict = can(actor, action, ticket);
  if (!verdict.allowed) {
    // Rejected transitions are the misuse signal (plan §8) — log them all.
    console.warn(
      JSON.stringify({
        event: "authz.denied",
        actorId: actor.id,
        role: actor.role,
        action,
        ticketStatus: ticket?.status ?? null,
        reason: verdict.reason,
      })
    );
    throw new ForbiddenError(verdict.reason);
  }
}
