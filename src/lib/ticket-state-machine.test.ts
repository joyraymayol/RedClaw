import { describe, expect, it } from "vitest";

import { TicketStatus, TicketType } from "@/generated/prisma/enums";
import {
  TICKET_TRANSITIONS,
  TERMINAL_STATUSES,
  canTransition,
  isTerminalStatus,
  transitionTarget,
  type TicketTransitionAction,
} from "@/lib/ticket-state-machine";

const ALL_STATUSES = Object.values(TicketStatus);
const ALL_ACTIONS = Object.keys(TICKET_TRANSITIONS) as TicketTransitionAction[];

/**
 * The full allowed matrix, spelled out independently of the production
 * map (plan §2 diagram). If either side drifts, a test fails.
 */
const EXPECTED: Record<TicketTransitionAction, TicketStatus[]> = {
  assignTicket: [TicketStatus.OPEN, TicketStatus.REOPENED],
  selfAssignTicket: [TicketStatus.OPEN, TicketStatus.REOPENED],
  startWork: [TicketStatus.ASSIGNED],
  holdTicket: [TicketStatus.IN_PROGRESS],
  resumeTicket: [TicketStatus.ON_HOLD],
  resolveTicket: [TicketStatus.IN_PROGRESS],
  verifyTicket: [TicketStatus.PENDING_VERIFICATION],
  reopenTicket: [TicketStatus.PENDING_VERIFICATION],
  escalateVerification: [TicketStatus.PENDING_VERIFICATION],
  closeTicket: [TicketStatus.PENDING_SUPERVISOR_REVIEW],
  rejectReview: [TicketStatus.PENDING_SUPERVISOR_REVIEW],
  cancelTicket: [TicketStatus.OPEN, TicketStatus.ASSIGNED],
  approveSetupMaintenance: [TicketStatus.PENDING_MAINTENANCE_APPROVAL],
  approveSetupQa: [TicketStatus.PENDING_QA_APPROVAL],
  rejectSetup: [
    TicketStatus.PENDING_MAINTENANCE_APPROVAL,
    TicketStatus.PENDING_QA_APPROVAL,
  ],
};

describe("canTransition", () => {
  // Exhaustive: every action × every status, allowed and forbidden alike.
  for (const action of ALL_ACTIONS) {
    for (const status of ALL_STATUSES) {
      const expected = EXPECTED[action].includes(status);
      it(`${action} from ${status} → ${expected ? "allowed" : "forbidden"}`, () => {
        expect(canTransition(action, status)).toBe(expected);
      });
    }
  }
});

describe("transitionTarget", () => {
  it.each([
    ["assignTicket", TicketStatus.ASSIGNED],
    ["selfAssignTicket", TicketStatus.ASSIGNED],
    ["startWork", TicketStatus.IN_PROGRESS],
    ["holdTicket", TicketStatus.ON_HOLD],
    ["resumeTicket", TicketStatus.IN_PROGRESS],
    ["resolveTicket", TicketStatus.PENDING_VERIFICATION],
    ["verifyTicket", TicketStatus.PENDING_SUPERVISOR_REVIEW],
    ["reopenTicket", TicketStatus.REOPENED],
    ["escalateVerification", TicketStatus.PENDING_SUPERVISOR_REVIEW],
    ["closeTicket", TicketStatus.CLOSED],
    ["rejectReview", TicketStatus.REOPENED],
    ["cancelTicket", TicketStatus.CANCELLED],
    ["approveSetupMaintenance", TicketStatus.PENDING_QA_APPROVAL],
    ["approveSetupQa", TicketStatus.CLOSED],
    ["rejectSetup", TicketStatus.REOPENED],
  ] as const)("%s lands in %s", (action, to) => {
    expect(transitionTarget(action)).toBe(to);
  });

  it("resolveTicket target is type-aware", () => {
    expect(transitionTarget("resolveTicket", TicketType.MAINTENANCE)).toBe(
      TicketStatus.PENDING_VERIFICATION
    );
    expect(transitionTarget("resolveTicket", TicketType.PREVENTIVE_MAINTENANCE)).toBe(
      TicketStatus.PENDING_SUPERVISOR_REVIEW
    );
    expect(transitionTarget("resolveTicket", TicketType.MACHINE_SETUP)).toBe(
      TicketStatus.PENDING_MAINTENANCE_APPROVAL
    );
    // Defaults to the MAINTENANCE target when no type is given.
    expect(transitionTarget("resolveTicket")).toBe(TicketStatus.PENDING_VERIFICATION);
  });
});

describe("terminal statuses", () => {
  it("CLOSED and CANCELLED are terminal, nothing else is", () => {
    expect(TERMINAL_STATUSES).toEqual([TicketStatus.CLOSED, TicketStatus.CANCELLED]);
    for (const status of ALL_STATUSES) {
      expect(isTerminalStatus(status)).toBe(TERMINAL_STATUSES.includes(status));
    }
  });

  it("no action can fire from a terminal status", () => {
    for (const status of TERMINAL_STATUSES) {
      for (const action of ALL_ACTIONS) {
        expect(canTransition(action, status)).toBe(false);
      }
    }
  });

  it("every non-terminal status has at least one way out", () => {
    for (const status of ALL_STATUSES) {
      if (isTerminalStatus(status)) continue;
      const hasExit = ALL_ACTIONS.some(
        (action) => canTransition(action, status) && transitionTarget(action) !== status
      );
      expect(hasExit, `${status} must not be a dead end`).toBe(true);
    }
  });

  it("once work has started, cancellation is impossible", () => {
    for (const status of [
      TicketStatus.IN_PROGRESS,
      TicketStatus.ON_HOLD,
      TicketStatus.PENDING_VERIFICATION,
      TicketStatus.PENDING_SUPERVISOR_REVIEW,
      TicketStatus.REOPENED,
    ]) {
      expect(canTransition("cancelTicket", status)).toBe(false);
    }
  });
});
