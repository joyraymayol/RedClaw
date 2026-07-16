"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { runAction } from "@/lib/actions/action-helpers";
import { requireActiveUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { diffAssignees } from "@/lib/assignment-diff";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { nextTicketNumber } from "@/lib/ticket-number";
import { openAssignmentsInclude, toTicketContext } from "@/lib/ticket-context";
import { transitionTarget, type TicketTransitionAction } from "@/lib/ticket-state-machine";
import {
  adminCancelSchema,
  assignSchema,
  cancelSchema,
  holdSchema,
  newTicketSchema,
  reopenSchema,
  rejectReviewSchema,
  remarkSchema,
  ticketIdSchema,
} from "@/lib/validations/ticket";
import type { Prisma, Ticket } from "@/generated/prisma/client";

export type TicketActionState = {
  error?: string;
  success?: boolean;
};

// ── Create ──────────────────────────────────────────────────────────────

type CreateTicketResult = TicketActionState & { ticketId?: string };

export async function createTicket(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  const result = await runAction<CreateTicketResult>(async () => {
    const user = await requireActiveUser();
    assertCan(user, "createTicket");

    const parsed = newTicketSchema.safeParse({
      machineId: formData.get("machineId"),
      problemTypeId: formData.get("problemTypeId"),
      suggestedSolutionId: formData.get("suggestedSolutionId"),
      priority: formData.get("priority"),
      title: formData.get("title"),
      description: formData.get("description"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { priority, ...rest } = parsed.data;

    const ticketId = await prisma.$transaction(async (tx) => {
      const slaPolicy = await tx.slaPolicy.findUnique({ where: { priority } });
      const now = Date.now();
      const ackDueAt = slaPolicy ? new Date(now + slaPolicy.ackMinutes * 60_000) : null;
      const resolveDueAt = slaPolicy
        ? new Date(now + slaPolicy.resolveMinutes * 60_000)
        : null;

      const ticket = await tx.ticket.create({
        data: {
          ...rest,
          priority,
          ticketNumber: await nextTicketNumber(tx),
          requesterId: user.id,
          ackDueAt,
          resolveDueAt,
        },
      });

      await tx.ticketStatusHistory.create({
        data: { ticketId: ticket.id, fromStatus: null, toStatus: "OPEN", changedById: user.id },
      });

      return ticket.id;
    });

    return { success: true, ticketId };
  });

  if (result.success && result.ticketId) {
    revalidatePath("/tickets");
    redirect(`/tickets/${result.ticketId}`);
  }
  return result;
}

// ── Shared transition executor ──────────────────────────────────────────
// Runs one lifecycle transition (plan §2) as a single transaction: the
// status change guarded optimistically, plus the TicketStatusHistory row
// that both audits it and feeds the "time spent" reports.

type TransitionOptions = {
  data?: Prisma.TicketUpdateManyMutationInput;
  note?: string;
  /** Runs first inside the transaction — e.g. the technician busy-check. */
  guard?: (tx: Prisma.TransactionClient) => Promise<void>;
};

async function runTransition(
  ticketId: string,
  action: TicketTransitionAction,
  options: TransitionOptions = {}
): Promise<Ticket> {
  const user = await requireActiveUser();

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: openAssignmentsInclude,
  });
  if (!ticket) throw new ConflictError("Ticket not found.");

  assertCan(user, action, toTicketContext(ticket));
  const toStatus = transitionTarget(action);

  await prisma.$transaction(async (tx) => {
    if (options.guard) await options.guard(tx);

    const { count } = await tx.ticket.updateMany({
      where: { id: ticketId, status: ticket.status },
      data: { status: toStatus, ...options.data },
    });
    if (count === 0) throw new ConflictError("Ticket changed state — refresh and retry.");

    await tx.ticketStatusHistory.create({
      data: {
        ticketId,
        fromStatus: ticket.status,
        toStatus,
        changedById: user.id,
        note: options.note,
      },
    });
  });

  revalidatePath("/tickets");
  revalidatePath(`/tickets/${ticketId}`);
  return ticket;
}

function ticketIdFrom(formData: FormData): string | null {
  const parsed = ticketIdSchema.safeParse({ ticketId: formData.get("ticketId") });
  return parsed.success ? parsed.data.ticketId : null;
}

// ── Technician actions ──────────────────────────────────────────────────

/**
 * A technician is "busy" if they hold an open membership on another
 * IN_PROGRESS ticket — teammates' busy-ness never blocks (plan §2): only
 * the acting technician's own workload is checked, and only app-level (the
 * old DB partial-unique-index backstop was keyed to the single-assignee
 * scalar and can't express a flat-team membership rule).
 */
async function findBusyTicket(tx: Prisma.TransactionClient, technicianId: string, excludeTicketId: string) {
  return tx.ticket.findFirst({
    where: {
      status: "IN_PROGRESS",
      id: { not: excludeTicketId },
      assignments: { some: { technicianId, unassignedAt: null } },
    },
  });
}

export async function startWork(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const ticketId = ticketIdFrom(formData);
    if (!ticketId) return { error: "Missing ticket." };

    const user = await requireActiveUser();
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    await runTransition(ticketId, "startWork", {
      data: ticket?.startedAt ? {} : { startedAt: new Date() },
      guard: async (tx) => {
        const busy = await findBusyTicket(tx, user.id, ticketId);
        if (busy) {
          throw new ConflictError(
            `Finish or hold ${busy.ticketNumber} before starting another ticket.`
          );
        }
      },
    });
    return { success: true };
  });
}

export async function holdTicket(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const parsed = holdSchema.safeParse({
      ticketId: formData.get("ticketId"),
      holdReason: formData.get("holdReason"),
      note: formData.get("note"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    await runTransition(parsed.data.ticketId, "holdTicket", {
      data: { holdReason: parsed.data.holdReason },
      note: parsed.data.note,
    });
    return { success: true };
  });
}

export async function resumeTicket(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const ticketId = ticketIdFrom(formData);
    if (!ticketId) return { error: "Missing ticket." };

    const user = await requireActiveUser();
    await runTransition(ticketId, "resumeTicket", {
      data: { holdReason: null },
      guard: async (tx) => {
        const busy = await findBusyTicket(tx, user.id, ticketId);
        if (busy) {
          throw new ConflictError(
            `Finish or hold ${busy.ticketNumber} before resuming another ticket.`
          );
        }
      },
    });
    return { success: true };
  });
}

export async function resolveTicket(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const ticketId = ticketIdFrom(formData);
    if (!ticketId) return { error: "Missing ticket." };

    await runTransition(ticketId, "resolveTicket", { data: { resolvedAt: new Date() } });
    return { success: true };
  });
}

// ── Requester verification ──────────────────────────────────────────────

export async function verifyTicket(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const ticketId = ticketIdFrom(formData);
    if (!ticketId) return { error: "Missing ticket." };

    await runTransition(ticketId, "verifyTicket", { data: { verifiedAt: new Date() } });
    return { success: true };
  });
}

export async function reopenTicket(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const parsed = reopenSchema.safeParse({
      ticketId: formData.get("ticketId"),
      note: formData.get("note"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    await runTransition(parsed.data.ticketId, "reopenTicket", {
      data: { reopenCount: { increment: 1 } },
      note: parsed.data.note,
    });
    return { success: true };
  });
}

// ── Supervisor QA ────────────────────────────────────────────────────────

export async function escalateVerification(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const ticketId = ticketIdFrom(formData);
    if (!ticketId) return { error: "Missing ticket." };

    await runTransition(ticketId, "escalateVerification", {
      note: "Escalated by a supervisor — no response from the requester.",
    });
    return { success: true };
  });
}

export async function closeTicket(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const ticketId = ticketIdFrom(formData);
    if (!ticketId) return { error: "Missing ticket." };

    await runTransition(ticketId, "closeTicket", { data: { closedAt: new Date() } });
    return { success: true };
  });
}

export async function rejectReview(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const parsed = rejectReviewSchema.safeParse({
      ticketId: formData.get("ticketId"),
      note: formData.get("note"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    await runTransition(parsed.data.ticketId, "rejectReview", {
      data: { reopenCount: { increment: 1 } },
      note: parsed.data.note,
    });
    return { success: true };
  });
}

// ── Cancel ───────────────────────────────────────────────────────────────
// Requester may cancel their own OPEN ticket with an optional note; an
// admin may additionally cancel an ASSIGNED one but must explain why
// (plan §2) — that distinction can't live in the zod schema since it
// depends on who's asking, so it's enforced here.

export async function cancelTicket(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const user = await requireActiveUser();
    const isAdmin = user.role === "ADMIN" || user.role === "HEAD";

    const parsed = (isAdmin ? adminCancelSchema : cancelSchema).safeParse({
      ticketId: formData.get("ticketId"),
      note: formData.get("note"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    await runTransition(parsed.data.ticketId, "cancelTicket", {
      data: { cancelledAt: new Date() },
      note: parsed.data.note || undefined,
    });
    return { success: true };
  });
}

// ── Assignment ───────────────────────────────────────────────────────────
// Flat team of equals — no lead/primary. Current membership is the set of
// TicketAssignment rows still open (unassignedAt: null); every member gets
// full work rights (see authz.ts). assignTicket sets the initial team from
// OPEN/REOPENED; updateAssignees adds/removes members afterward without
// touching status.

async function loadActiveTechnicians(technicianIds: string[]) {
  const technicians = await prisma.user.findMany({
    where: { id: { in: technicianIds }, role: "TECHNICIAN", status: "ACTIVE" },
  });
  if (technicians.length !== technicianIds.length) return null;
  return technicians;
}

export async function assignTicket(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const admin = await requireActiveUser();
    const parsed = assignSchema.safeParse({
      ticketId: formData.get("ticketId"),
      technicianIds: formData.getAll("technicianIds"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { ticketId, technicianIds } = parsed.data;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: openAssignmentsInclude,
    });
    if (!ticket) return { error: "Ticket not found." };
    assertCan(admin, "assignTicket", toTicketContext(ticket));

    const technicians = await loadActiveTechnicians(technicianIds);
    if (!technicians) return { error: "Pick active technicians only." };
    const names = technicians.map((t) => t.name).join(", ");

    // Priority interrupt (plan §2): assigning a HIGH/CRITICAL ticket to
    // technicians who are mid-IN_PROGRESS on something else bumps those
    // tickets to ON_HOLD and starts this one immediately, per busy member.
    const busyTickets = await prisma.ticket.findMany({
      where: {
        status: "IN_PROGRESS",
        assignments: { some: { technicianId: { in: technicianIds }, unassignedAt: null } },
      },
    });
    const shouldPreempt =
      busyTickets.length > 0 && (ticket.priority === "HIGH" || ticket.priority === "CRITICAL");

    await prisma.$transaction(async (tx) => {
      // Close any stale open rows first — normally none, but a REOPENED
      // ticket's earlier row can otherwise survive uncleared and collide
      // with the one-open-row-per-member index.
      await tx.ticketAssignment.updateMany({
        where: { ticketId, unassignedAt: null },
        data: { unassignedAt: new Date() },
      });

      if (shouldPreempt) {
        for (const busyTicket of busyTickets) {
          const { count: heldCount } = await tx.ticket.updateMany({
            where: { id: busyTicket.id, status: "IN_PROGRESS" },
            data: { status: "ON_HOLD", holdReason: "PREEMPTED_BY_HIGHER_PRIORITY" },
          });
          if (heldCount === 0) {
            throw new ConflictError("A technician's active ticket changed — refresh and retry.");
          }
          await tx.ticketStatusHistory.create({
            data: {
              ticketId: busyTicket.id,
              fromStatus: "IN_PROGRESS",
              toStatus: "ON_HOLD",
              changedById: admin.id,
              note: `Preempted by higher-priority ticket ${ticket.ticketNumber}`,
            },
          });
        }

        const { count } = await tx.ticket.updateMany({
          where: { id: ticketId, status: ticket.status },
          data: { status: "IN_PROGRESS", startedAt: ticket.startedAt ?? new Date() },
        });
        if (count === 0) throw new ConflictError("Ticket changed state — refresh and retry.");
        await tx.ticketStatusHistory.create({
          data: {
            ticketId,
            fromStatus: ticket.status,
            toStatus: "IN_PROGRESS",
            changedById: admin.id,
            note: `Preempts ${busyTickets.map((t) => t.ticketNumber).join(", ")} — assigned to ${names}`,
          },
        });
        await tx.ticketAssignment.createMany({
          data: technicianIds.map((technicianId) => ({
            ticketId,
            technicianId,
            assignedById: admin.id,
            reason: "PREEMPTED_BY_HIGHER_PRIORITY" as const,
          })),
        });
      } else {
        const { count } = await tx.ticket.updateMany({
          where: { id: ticketId, status: ticket.status },
          data: { status: "ASSIGNED" },
        });
        if (count === 0) throw new ConflictError("Ticket changed state — refresh and retry.");
        await tx.ticketStatusHistory.create({
          data: {
            ticketId,
            fromStatus: ticket.status,
            toStatus: "ASSIGNED",
            changedById: admin.id,
            note: `Assigned to ${names}`,
          },
        });
        await tx.ticketAssignment.createMany({
          data: technicianIds.map((technicianId) => ({
            ticketId,
            technicianId,
            assignedById: admin.id,
            reason: ticket.status === "REOPENED" ? ("REOPENED" as const) : ("INITIAL_ASSIGN" as const),
          })),
        });
      }
    });

    revalidatePath("/tickets");
    revalidatePath(`/tickets/${ticketId}`);
    return { success: true };
  });
}

export async function updateAssignees(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const admin = await requireActiveUser();
    const parsed = assignSchema.safeParse({
      ticketId: formData.get("ticketId"),
      technicianIds: formData.getAll("technicianIds"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { ticketId, technicianIds } = parsed.data;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: openAssignmentsInclude,
    });
    if (!ticket) return { error: "Ticket not found." };
    const ctx = toTicketContext(ticket);
    assertCan(admin, "updateAssignees", ctx);

    const { toAdd, toRemove } = diffAssignees(ctx.assigneeIds, technicianIds);
    if (toAdd.length === 0 && toRemove.length === 0) {
      return { error: "No membership changes." };
    }

    const addedTechnicians = toAdd.length ? await loadActiveTechnicians(toAdd) : [];
    if (!addedTechnicians) return { error: "Pick active technicians only." };
    const removedTechnicians = toRemove.length
      ? await prisma.user.findMany({
          where: { id: { in: toRemove } },
          select: { id: true, name: true },
        })
      : [];

    await prisma.$transaction(async (tx) => {
      // Membership edit, not a status transition — the status itself is
      // rewritten unchanged just to drive the optimistic concurrency guard.
      const { count } = await tx.ticket.updateMany({
        where: { id: ticketId, status: ticket.status },
        data: { status: ticket.status },
      });
      if (count === 0) throw new ConflictError("Ticket changed state — refresh and retry.");

      if (toRemove.length > 0) {
        await tx.ticketAssignment.updateMany({
          where: { ticketId, technicianId: { in: toRemove }, unassignedAt: null },
          data: { unassignedAt: new Date() },
        });
      }
      if (toAdd.length > 0) {
        await tx.ticketAssignment.createMany({
          data: toAdd.map((technicianId) => ({
            ticketId,
            technicianId,
            assignedById: admin.id,
            reason: "REASSIGNED" as const,
          })),
        });
      }

      const parts = [
        addedTechnicians.length && `added: ${addedTechnicians.map((t) => t.name).join(", ")}`,
        removedTechnicians.length && `removed: ${removedTechnicians.map((t) => t.name).join(", ")}`,
      ].filter(Boolean);

      await tx.ticketStatusHistory.create({
        data: {
          ticketId,
          fromStatus: ticket.status,
          toStatus: ticket.status,
          changedById: admin.id,
          note: `Team updated — ${parts.join("; ")}`,
        },
      });
    });

    revalidatePath("/tickets");
    revalidatePath(`/tickets/${ticketId}`);
    return { success: true };
  });
}

// ── Remarks ──────────────────────────────────────────────────────────────

export async function addRemark(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const user = await requireActiveUser();
    const parsed = remarkSchema.safeParse({
      ticketId: formData.get("ticketId"),
      body: formData.get("body"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { ticketId, body } = parsed.data;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: openAssignmentsInclude,
    });
    if (!ticket) return { error: "Ticket not found." };
    assertCan(user, "addRemark", toTicketContext(ticket));

    await prisma.ticketRemark.create({
      data: { ticketId, userId: user.id, body, type: "WORK_LOG" },
    });

    revalidatePath(`/tickets/${ticketId}`);
    return { success: true };
  });
}
