import type { Prisma } from "@/generated/prisma/client";
import type { TicketContext } from "@/lib/authz";

/**
 * Shared query fragment: the ticket's *current* team is the set of
 * TicketAssignment rows still open (`unassignedAt: null`) — not a scalar
 * column. Every read site that needs `assigneeIds` for `can()` includes this.
 */
export const openAssignmentsInclude = {
  assignments: {
    where: { unassignedAt: null },
    select: { technicianId: true },
  },
} satisfies Prisma.TicketInclude;

type TicketWithOpenAssignments = {
  status: TicketContext["status"];
  requesterId: string;
  assignments: { technicianId: string }[];
};

/** Maps a ticket fetched with `openAssignmentsInclude` to the pure authz shape. */
export function toTicketContext(ticket: TicketWithOpenAssignments): TicketContext {
  return {
    status: ticket.status,
    requesterId: ticket.requesterId,
    assigneeIds: ticket.assignments.map((a) => a.technicianId),
  };
}
