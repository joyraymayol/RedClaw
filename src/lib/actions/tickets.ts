"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { runAction } from "@/lib/actions/action-helpers";
import { requireActiveUser } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { nextTicketNumber } from "@/lib/ticket-number";
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
};

async function runTransition(
  ticketId: string,
  action: TicketTransitionAction,
  options: TransitionOptions = {}
): Promise<Ticket> {
  const user = await requireActiveUser();

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new ConflictError("Ticket not found.");

  assertCan(user, action, ticket);
  const toStatus = transitionTarget(action);

  await prisma.$transaction(async (tx) => {
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

export async function startWork(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const ticketId = ticketIdFrom(formData);
    if (!ticketId) return { error: "Missing ticket." };

    const user = await requireActiveUser();
    // Friendlier than waiting for the partial-unique-index violation, which
    // still stands as the DB-level backstop against a same-instant race.
    const busy = await prisma.ticket.findFirst({
      where: { assignedTechnicianId: user.id, status: "IN_PROGRESS" },
    });
    if (busy) {
      return {
        error: `Finish or hold ${busy.ticketNumber} before starting another ticket.`,
      };
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    await runTransition(ticketId, "startWork", {
      data: ticket?.startedAt ? {} : { startedAt: new Date() },
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
    const busy = await prisma.ticket.findFirst({
      where: { assignedTechnicianId: user.id, status: "IN_PROGRESS" },
    });
    if (busy) {
      return {
        error: `Finish or hold ${busy.ticketNumber} before resuming another ticket.`,
      };
    }

    await runTransition(ticketId, "resumeTicket", { data: { holdReason: null } });
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

async function loadActiveTechnician(technicianId: string) {
  const technician = await prisma.user.findUnique({ where: { id: technicianId } });
  if (!technician || technician.role !== "TECHNICIAN" || technician.status !== "ACTIVE") {
    return null;
  }
  return technician;
}

export async function assignTicket(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const admin = await requireActiveUser();
    const parsed = assignSchema.safeParse({
      ticketId: formData.get("ticketId"),
      technicianId: formData.get("technicianId"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { ticketId, technicianId } = parsed.data;

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return { error: "Ticket not found." };
    assertCan(admin, "assignTicket", ticket);

    const technician = await loadActiveTechnician(technicianId);
    if (!technician) return { error: "Pick an active technician." };

    // Priority interrupt (plan §2): assigning a HIGH/CRITICAL ticket to a
    // technician who's mid-IN_PROGRESS on something else bumps that ticket
    // to ON_HOLD and starts this one immediately, instead of queueing behind it.
    const busyTicket = await prisma.ticket.findFirst({
      where: { assignedTechnicianId: technicianId, status: "IN_PROGRESS" },
    });
    const shouldPreempt =
      !!busyTicket && (ticket.priority === "HIGH" || ticket.priority === "CRITICAL");

    await prisma.$transaction(async (tx) => {
      if (shouldPreempt && busyTicket) {
        const { count: heldCount } = await tx.ticket.updateMany({
          where: { id: busyTicket.id, status: "IN_PROGRESS" },
          data: { status: "ON_HOLD", holdReason: "PREEMPTED_BY_HIGHER_PRIORITY" },
        });
        if (heldCount === 0) {
          throw new ConflictError("The technician's active ticket changed — refresh and retry.");
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

        const { count } = await tx.ticket.updateMany({
          where: { id: ticketId, status: ticket.status },
          data: {
            status: "IN_PROGRESS",
            assignedTechnicianId: technicianId,
            startedAt: ticket.startedAt ?? new Date(),
          },
        });
        if (count === 0) throw new ConflictError("Ticket changed state — refresh and retry.");
        await tx.ticketStatusHistory.create({
          data: {
            ticketId,
            fromStatus: ticket.status,
            toStatus: "IN_PROGRESS",
            changedById: admin.id,
            note: `Preempts ${busyTicket.ticketNumber}`,
          },
        });
        await tx.ticketAssignment.create({
          data: {
            ticketId,
            technicianId,
            assignedById: admin.id,
            reason: "PREEMPTED_BY_HIGHER_PRIORITY",
          },
        });
      } else {
        const { count } = await tx.ticket.updateMany({
          where: { id: ticketId, status: ticket.status },
          data: { status: "ASSIGNED", assignedTechnicianId: technicianId },
        });
        if (count === 0) throw new ConflictError("Ticket changed state — refresh and retry.");
        await tx.ticketStatusHistory.create({
          data: {
            ticketId,
            fromStatus: ticket.status,
            toStatus: "ASSIGNED",
            changedById: admin.id,
          },
        });
        await tx.ticketAssignment.create({
          data: {
            ticketId,
            technicianId,
            assignedById: admin.id,
            reason: ticket.status === "REOPENED" ? "REOPENED" : "INITIAL_ASSIGN",
          },
        });
      }
    });

    revalidatePath("/tickets");
    revalidatePath(`/tickets/${ticketId}`);
    return { success: true };
  });
}

export async function reassignTicket(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const admin = await requireActiveUser();
    const parsed = assignSchema.safeParse({
      ticketId: formData.get("ticketId"),
      technicianId: formData.get("technicianId"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { ticketId, technicianId } = parsed.data;

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return { error: "Ticket not found." };
    assertCan(admin, "reassignTicket", ticket);

    if (technicianId === ticket.assignedTechnicianId) {
      return { error: "Already assigned to that technician." };
    }
    const technician = await loadActiveTechnician(technicianId);
    if (!technician) return { error: "Pick an active technician." };

    await prisma.$transaction(async (tx) => {
      const { count } = await tx.ticket.updateMany({
        where: { id: ticketId, status: "ASSIGNED" },
        data: { assignedTechnicianId: technicianId },
      });
      if (count === 0) throw new ConflictError("Ticket changed state — refresh and retry.");

      await tx.ticketStatusHistory.create({
        data: {
          ticketId,
          fromStatus: "ASSIGNED",
          toStatus: "ASSIGNED",
          changedById: admin.id,
          note: `Reassigned to ${technician.name}`,
        },
      });
      await tx.ticketAssignment.updateMany({
        where: { ticketId, unassignedAt: null },
        data: { unassignedAt: new Date() },
      });
      await tx.ticketAssignment.create({
        data: { ticketId, technicianId, assignedById: admin.id, reason: "REASSIGNED" },
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

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) return { error: "Ticket not found." };
    assertCan(user, "addRemark", ticket);

    await prisma.ticketRemark.create({
      data: { ticketId, userId: user.id, body, type: "WORK_LOG" },
    });

    revalidatePath(`/tickets/${ticketId}`);
    return { success: true };
  });
}
