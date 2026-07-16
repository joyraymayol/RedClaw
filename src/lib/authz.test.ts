import { describe, expect, it } from "vitest";

import { TicketStatus, UserRole } from "@/generated/prisma/enums";
import {
  assertCan,
  can,
  ForbiddenError,
  type Actor,
  type TicketAction,
  type TicketContext,
} from "@/lib/authz";

const ALL_ROLES = Object.values(UserRole);

function actor(overrides: Partial<Actor> = {}): Actor {
  return { id: "user-1", role: UserRole.REQUESTER, status: "ACTIVE", ...overrides };
}

function ticket(overrides: Partial<TicketContext> = {}): TicketContext {
  return {
    status: TicketStatus.OPEN,
    requesterId: "requester-1",
    assigneeIds: [],
    ...overrides,
  };
}

const requester = actor({ id: "requester-1", role: UserRole.REQUESTER });
const technician = actor({ id: "tech-1", role: UserRole.TECHNICIAN });
const admin = actor({ id: "admin-1", role: UserRole.ADMIN });
const supervisor = actor({ id: "supervisor-1", role: UserRole.SUPERVISOR });
const head = actor({ id: "head-1", role: UserRole.HEAD });

describe("account gating", () => {
  const someTicket = ticket();

  it("denies every action to non-ACTIVE accounts", () => {
    for (const status of ["PENDING_PROFILE", "PENDING_APPROVAL", "DISABLED"] as const) {
      const blocked = actor({ status });
      expect(can(blocked, "createTicket").allowed).toBe(false);
      expect(can(blocked, "addRemark", someTicket).allowed).toBe(false);
    }
  });

  it("denies everything while role is still unassigned", () => {
    const roleless = actor({ role: null });
    expect(can(roleless, "createTicket").allowed).toBe(false);
  });

  it("denies ticket-bound actions when no ticket context is passed", () => {
    expect(can(admin, "assignTicket").allowed).toBe(false);
  });
});

describe("createTicket", () => {
  it("is allowed for every active role", () => {
    for (const role of ALL_ROLES) {
      expect(can(actor({ role }), "createTicket").allowed).toBe(true);
    }
  });
});

describe("requester actions", () => {
  it("may verify or reject the fix on their own ticket pending verification", () => {
    const t = ticket({ status: TicketStatus.PENDING_VERIFICATION });
    expect(can(requester, "verifyTicket", t).allowed).toBe(true);
    expect(can(requester, "reopenTicket", t).allowed).toBe(true);
  });

  it("may not verify someone else's ticket — regardless of role", () => {
    const t = ticket({
      status: TicketStatus.PENDING_VERIFICATION,
      requesterId: "someone-else",
    });
    for (const a of [requester, technician, admin, supervisor, head]) {
      expect(can(a, "verifyTicket", t).allowed).toBe(false);
      expect(can(a, "reopenTicket", t).allowed).toBe(false);
    }
  });

  it("may cancel their own ticket only while it is still OPEN", () => {
    expect(can(requester, "cancelTicket", ticket({ status: TicketStatus.OPEN })).allowed).toBe(
      true
    );
    expect(
      can(requester, "cancelTicket", ticket({ status: TicketStatus.ASSIGNED })).allowed
    ).toBe(false);
  });

  it("may not cancel someone else's ticket", () => {
    const t = ticket({ requesterId: "someone-else" });
    expect(can(requester, "cancelTicket", t).allowed).toBe(false);
  });

  it("may not perform technician, admin, or supervisor actions", () => {
    const assigned = ticket({ status: TicketStatus.ASSIGNED, assigneeIds: ["tech-1"] });
    const inReview = ticket({ status: TicketStatus.PENDING_SUPERVISOR_REVIEW });
    expect(can(requester, "startWork", assigned).allowed).toBe(false);
    expect(can(requester, "assignTicket", ticket()).allowed).toBe(false);
    expect(can(requester, "closeTicket", inReview).allowed).toBe(false);
  });
});

describe("technician actions", () => {
  const mine = { assigneeIds: [technician.id] };

  it("may start, hold, resume, and resolve only their own assigned ticket", () => {
    expect(
      can(technician, "startWork", ticket({ status: TicketStatus.ASSIGNED, ...mine })).allowed
    ).toBe(true);
    expect(
      can(technician, "holdTicket", ticket({ status: TicketStatus.IN_PROGRESS, ...mine })).allowed
    ).toBe(true);
    expect(
      can(technician, "resumeTicket", ticket({ status: TicketStatus.ON_HOLD, ...mine })).allowed
    ).toBe(true);
    expect(
      can(technician, "resolveTicket", ticket({ status: TicketStatus.IN_PROGRESS, ...mine }))
        .allowed
    ).toBe(true);
  });

  it("is denied on tickets assigned to another technician", () => {
    const someoneElses = ticket({
      status: TicketStatus.ASSIGNED,
      assigneeIds: ["other-tech"],
    });
    expect(can(technician, "startWork", someoneElses).allowed).toBe(false);
  });

  it("is denied when the ticket is in the wrong state", () => {
    expect(can(technician, "startWork", ticket({ status: TicketStatus.OPEN, ...mine })).allowed).toBe(
      false
    );
    expect(
      can(technician, "holdTicket", ticket({ status: TicketStatus.ASSIGNED, ...mine })).allowed
    ).toBe(false);
    expect(
      can(technician, "resolveTicket", ticket({ status: TicketStatus.ON_HOLD, ...mine })).allowed
    ).toBe(false);
  });

  it("may not assign, cancel, or close", () => {
    expect(can(technician, "assignTicket", ticket()).allowed).toBe(false);
    expect(can(technician, "cancelTicket", ticket()).allowed).toBe(false);
    expect(
      can(technician, "closeTicket", ticket({ status: TicketStatus.PENDING_SUPERVISOR_REVIEW }))
        .allowed
    ).toBe(false);
  });
});

describe("admin actions", () => {
  it("may assign OPEN and REOPENED tickets", () => {
    expect(can(admin, "assignTicket", ticket({ status: TicketStatus.OPEN })).allowed).toBe(true);
    expect(can(admin, "assignTicket", ticket({ status: TicketStatus.REOPENED })).allowed).toBe(
      true
    );
  });

  it("may not assign a ticket that is already in progress", () => {
    expect(can(admin, "assignTicket", ticket({ status: TicketStatus.IN_PROGRESS })).allowed).toBe(
      false
    );
  });

  it("may cancel OPEN and ASSIGNED tickets, but never once work has started", () => {
    expect(can(admin, "cancelTicket", ticket({ status: TicketStatus.OPEN })).allowed).toBe(true);
    expect(can(admin, "cancelTicket", ticket({ status: TicketStatus.ASSIGNED })).allowed).toBe(
      true
    );
    for (const status of [
      TicketStatus.IN_PROGRESS,
      TicketStatus.ON_HOLD,
      TicketStatus.PENDING_VERIFICATION,
      TicketStatus.CLOSED,
      TicketStatus.CANCELLED,
    ]) {
      expect(can(admin, "cancelTicket", ticket({ status })).allowed).toBe(false);
    }
  });

  it("may not work tickets or perform supervisor QA", () => {
    const assigned = ticket({ status: TicketStatus.ASSIGNED, assigneeIds: ["tech-1"] });
    const inReview = ticket({ status: TicketStatus.PENDING_SUPERVISOR_REVIEW });
    expect(can(admin, "startWork", assigned).allowed).toBe(false);
    expect(can(admin, "closeTicket", inReview).allowed).toBe(false);
    expect(can(admin, "escalateVerification", ticket({ status: TicketStatus.PENDING_VERIFICATION })).allowed).toBe(false);
  });
});

describe("supervisor actions", () => {
  it("may escalate a stuck verification and settle reviews", () => {
    const pendingVerification = ticket({ status: TicketStatus.PENDING_VERIFICATION });
    const inReview = ticket({ status: TicketStatus.PENDING_SUPERVISOR_REVIEW });
    expect(can(supervisor, "escalateVerification", pendingVerification).allowed).toBe(true);
    expect(can(supervisor, "closeTicket", inReview).allowed).toBe(true);
    expect(can(supervisor, "rejectReview", inReview).allowed).toBe(true);
  });

  it("may not close a ticket that is not in review", () => {
    expect(
      can(supervisor, "closeTicket", ticket({ status: TicketStatus.PENDING_VERIFICATION })).allowed
    ).toBe(false);
  });

  it("may not assign or cancel", () => {
    expect(can(supervisor, "assignTicket", ticket()).allowed).toBe(false);
    expect(can(supervisor, "cancelTicket", ticket()).allowed).toBe(false);
  });
});

describe("head actions", () => {
  it("covers both admin and supervisor powers", () => {
    expect(can(head, "assignTicket", ticket({ status: TicketStatus.OPEN })).allowed).toBe(true);
    expect(can(head, "cancelTicket", ticket({ status: TicketStatus.ASSIGNED })).allowed).toBe(
      true
    );
    expect(
      can(head, "closeTicket", ticket({ status: TicketStatus.PENDING_SUPERVISOR_REVIEW })).allowed
    ).toBe(true);
    expect(
      can(head, "escalateVerification", ticket({ status: TicketStatus.PENDING_VERIFICATION }))
        .allowed
    ).toBe(true);
  });

  it("still cannot work a ticket assigned to someone else", () => {
    const assigned = ticket({ status: TicketStatus.ASSIGNED, assigneeIds: ["tech-1"] });
    expect(can(head, "startWork", assigned).allowed).toBe(false);
  });
});

describe("updateAssignees", () => {
  it("allows admin/head while ASSIGNED, IN_PROGRESS, or ON_HOLD", () => {
    for (const status of [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, TicketStatus.ON_HOLD]) {
      expect(can(admin, "updateAssignees", ticket({ status })).allowed).toBe(true);
      expect(can(head, "updateAssignees", ticket({ status })).allowed).toBe(true);
    }
  });

  it("denies in OPEN, REOPENED, PENDING_VERIFICATION, CLOSED, CANCELLED", () => {
    for (const status of [
      TicketStatus.OPEN,
      TicketStatus.REOPENED,
      TicketStatus.PENDING_VERIFICATION,
      TicketStatus.CLOSED,
      TicketStatus.CANCELLED,
    ]) {
      expect(can(admin, "updateAssignees", ticket({ status })).allowed).toBe(false);
    }
  });

  it("denies technician, supervisor, and requester regardless of status", () => {
    const t = ticket({ status: TicketStatus.ASSIGNED });
    expect(can(technician, "updateAssignees", t).allowed).toBe(false);
    expect(can(supervisor, "updateAssignees", t).allowed).toBe(false);
    expect(can(requester, "updateAssignees", t).allowed).toBe(false);
  });
});

describe("flat team of equals", () => {
  const team = ticket({ status: TicketStatus.IN_PROGRESS, assigneeIds: ["tech-1", "tech-2"] });
  const member1 = actor({ id: "tech-1", role: UserRole.TECHNICIAN });
  const member2 = actor({ id: "tech-2", role: UserRole.TECHNICIAN });
  const outsider = actor({ id: "tech-3", role: UserRole.TECHNICIAN });

  it("gives every member full work rights — no lead", () => {
    for (const member of [member1, member2]) {
      expect(can(member, "startWork", { ...team, status: TicketStatus.ASSIGNED }).allowed).toBe(
        true
      );
      expect(can(member, "holdTicket", team).allowed).toBe(true);
      expect(can(member, "resumeTicket", { ...team, status: TicketStatus.ON_HOLD }).allowed).toBe(
        true
      );
      expect(can(member, "resolveTicket", team).allowed).toBe(true);
      expect(can(member, "addRemark", team).allowed).toBe(true);
      expect(can(member, "logPartUsed", team).allowed).toBe(true);
    }
  });

  it("denies a technician who isn't on the team", () => {
    expect(can(outsider, "startWork", { ...team, status: TicketStatus.ASSIGNED }).allowed).toBe(
      false
    );
    expect(can(outsider, "holdTicket", team).allowed).toBe(false);
    expect(can(outsider, "resolveTicket", team).allowed).toBe(false);
    expect(can(outsider, "addRemark", team).allowed).toBe(false);
    expect(can(outsider, "logPartUsed", team).allowed).toBe(false);
  });

  it("denies technician work when the team is empty", () => {
    const unassigned = ticket({ status: TicketStatus.ASSIGNED, assigneeIds: [] });
    expect(can(member1, "startWork", unassigned).allowed).toBe(false);
  });
});

describe("addRemark", () => {
  const participants: Array<[string, Actor, TicketContext]> = [
    ["requester on own ticket", requester, ticket({ status: TicketStatus.IN_PROGRESS })],
    [
      "assigned technician",
      technician,
      ticket({ status: TicketStatus.IN_PROGRESS, assigneeIds: [technician.id] }),
    ],
    ["admin on any ticket", admin, ticket({ status: TicketStatus.IN_PROGRESS })],
    ["supervisor on any ticket", supervisor, ticket({ status: TicketStatus.IN_PROGRESS })],
    ["head on any ticket", head, ticket({ status: TicketStatus.IN_PROGRESS })],
  ];

  it.each(participants)("allows %s", (_label, a, t) => {
    expect(can(a, "addRemark", t).allowed).toBe(true);
  });

  it("denies an unrelated requester", () => {
    const t = ticket({ status: TicketStatus.IN_PROGRESS, requesterId: "someone-else" });
    expect(can(requester, "addRemark", t).allowed).toBe(false);
  });

  it("denies everyone once the ticket is closed or cancelled", () => {
    for (const status of [TicketStatus.CLOSED, TicketStatus.CANCELLED]) {
      expect(can(head, "addRemark", ticket({ status })).allowed).toBe(false);
      expect(can(requester, "addRemark", ticket({ status })).allowed).toBe(false);
    }
  });
});

describe("logPartUsed", () => {
  it("allows only the assigned technician, only while in progress", () => {
    const inProgress = ticket({
      status: TicketStatus.IN_PROGRESS,
      assigneeIds: [technician.id],
    });
    expect(can(technician, "logPartUsed", inProgress).allowed).toBe(true);

    expect(
      can(technician, "logPartUsed", ticket({ status: TicketStatus.ON_HOLD, assigneeIds: [technician.id] }))
        .allowed
    ).toBe(false);
    expect(can(admin, "logPartUsed", inProgress).allowed).toBe(false);
  });
});

describe("assertCan", () => {
  it("throws ForbiddenError with the denial reason", () => {
    expect(() => assertCan(requester, "assignTicket", ticket())).toThrow(ForbiddenError);
  });

  it("passes silently when allowed", () => {
    expect(() => assertCan(requester, "createTicket")).not.toThrow();
  });
});

describe("full matrix sanity", () => {
  const ALL_ACTIONS: TicketAction[] = [
    "createTicket",
    "assignTicket",
    "updateAssignees",
    "startWork",
    "holdTicket",
    "resumeTicket",
    "resolveTicket",
    "verifyTicket",
    "reopenTicket",
    "escalateVerification",
    "closeTicket",
    "rejectReview",
    "cancelTicket",
    "addRemark",
    "logPartUsed",
  ];

  it("nothing at all is allowed on a CANCELLED or CLOSED ticket", () => {
    for (const status of [TicketStatus.CANCELLED, TicketStatus.CLOSED]) {
      // Give the actor every advantage: HEAD role, requester AND technician of the ticket.
      const superActor = actor({ id: "omni", role: UserRole.HEAD });
      const t = ticket({ status, requesterId: "omni", assigneeIds: ["omni"] });
      for (const action of ALL_ACTIONS) {
        if (action === "createTicket") continue; // not ticket-bound
        expect(can(superActor, action, t).allowed, `${action} on ${status}`).toBe(false);
      }
    }
  });
});
