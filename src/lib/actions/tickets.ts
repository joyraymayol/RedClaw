"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { runAction } from "@/lib/actions/action-helpers";
import { requireActiveUser } from "@/lib/auth";
import { assertCan, canCreateTicketType } from "@/lib/authz";
import { diffIds } from "@/lib/id-diff";
import { ConflictError } from "@/lib/errors";
import {
  adminRecipients,
  createNotification,
  maintenanceLeads,
  notifyUsers,
  qaLeads,
  supervisors,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { applyCurrentProduct } from "@/lib/product-changeover";
import { canCreateNewSetupTicket } from "@/lib/production-plan-tickets";
import { nextTicketNumber } from "@/lib/ticket-number";
import {
  openAssetFlagsInclude,
  openAssignmentsInclude,
  toTicketContext,
} from "@/lib/ticket-context";
import { transitionTarget, type TicketTransitionAction } from "@/lib/ticket-state-machine";
import {
  adminCancelSchema,
  assignSchema,
  cancelSchema,
  flagAssetsSchema,
  holdSchema,
  logMaterialSchema,
  newTicketSchema,
  removeMaterialSchema,
  reopenSchema,
  rejectReviewSchema,
  rejectSetupSchema,
  remarkSchema,
  ticketIdSchema,
} from "@/lib/validations/ticket";
import type { Prisma, Ticket } from "@/generated/prisma/client";
import type { TicketStatus } from "@/generated/prisma/enums";

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
      type: formData.get("type") ?? undefined,
      assetId: formData.get("assetId"),
      problemTypeId: formData.get("problemTypeId"),
      suggestedSolutionId: formData.get("suggestedSolutionId"),
      priority: formData.get("priority"),
      title: formData.get("title"),
      description: formData.get("description"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { priority, assetId, type, targetProductId, ...rest } = parsed.data;

    // Type-specific creation gate (department + role). MAINTENANCE is open to
    // any active employee; PM/Machine-Setup are Maintenance-lead only.
    const typeVerdict = canCreateTicketType(user, type);
    if (!typeVerdict.allowed) return { error: typeVerdict.reason };

    const asset = await prisma.asset.findUnique({
      where: { id: assetId },
      select: {
        status: true,
        pmChecklistTemplateId: true,
        productCapabilities: { select: { productId: true } },
      },
    });
    if (!asset || asset.status === "RETIRED") {
      return { error: "Selected asset is retired or no longer exists." };
    }

    // A manually-raised Machine-Setup may name the mold to switch to on QA
    // close — it must be one the machine is capable of running.
    let setupTargetProductId: string | null = null;
    if (type === "MACHINE_SETUP" && targetProductId) {
      if (!asset.productCapabilities.some((c) => c.productId === targetProductId)) {
        return { error: "Choose a target product this machine is capable of running." };
      }
      setupTargetProductId = targetProductId;
    }

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
          type,
          priority,
          targetProductId: setupTargetProductId,
          ticketNumber: await nextTicketNumber(tx),
          requesterId: user.id,
          ackDueAt,
          resolveDueAt,
        },
      });

      await tx.ticketAsset.create({
        data: { ticketId: ticket.id, assetId, flaggedById: user.id },
      });

      await tx.ticketStatusHistory.create({
        data: { ticketId: ticket.id, fromStatus: null, toStatus: "OPEN", changedById: user.id },
      });

      await notifyUsers(tx, await adminRecipients(tx), {
        type: "TICKET_NEEDS_ASSIGNMENT",
        title: `${ticket.ticketNumber} needs assignment`,
        body: ticket.title,
        linkPath: `/tickets/${ticket.id}`,
        actorId: user.id,
      });

      // PM tickets snapshot the machine's default checklist so later template
      // edits never rewrite this ticket's checklist.
      if (type === "PREVENTIVE_MAINTENANCE" && asset.pmChecklistTemplateId) {
        const items = await tx.pmChecklistTemplateItem.findMany({
          where: { templateId: asset.pmChecklistTemplateId },
          orderBy: { sortOrder: "asc" },
          select: { label: true, sortOrder: true },
        });
        if (items.length > 0) {
          await tx.ticketChecklistResult.createMany({
            data: items.map((it) => ({
              ticketId: ticket.id,
              label: it.label,
              sortOrder: it.sortOrder,
            })),
          });
        }
      }

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

/**
 * Spin a Machine-Setup ticket off an approved Production Plan row (plan §6),
 * pre-filled with the row's machine and target product. Maintenance leads
 * only. A row may only have one *current* setup ticket at a time — see
 * canCreateNewSetupTicket — but a mid-week edit to the row (or the prior
 * ticket being Cancelled outright) opens the door to a new one, so a plan
 * can end up with several setup tickets against the same row over its life.
 */
export async function createMachineSetupFromPlanRow(
  rowId: string
): Promise<TicketActionState> {
  const result = await runAction<CreateTicketResult>(async () => {
    const user = await requireActiveUser();
    const verdict = canCreateTicketType(user, "MACHINE_SETUP");
    if (!verdict.allowed) return { error: verdict.reason };

    const row = await prisma.productionPlanRow.findUnique({
      where: { id: rowId },
      include: {
        plan: { select: { status: true, formNumber: true } },
        asset: { select: { id: true, name: true, status: true } },
        product: { select: { name: true } },
      },
    });
    if (!row) return { error: "Plan row not found." };
    if (row.plan.status !== "APPROVED") {
      return { error: "The plan must be approved before creating setup tickets." };
    }
    if (row.asset.status === "RETIRED") {
      return { error: "That machine is retired." };
    }

    // Don't spawn a duplicate while the row's most recent setup ticket is
    // still current for what the row asks for today (see
    // canCreateNewSetupTicket for what makes a ticket "current").
    const latestTicket = await prisma.ticket.findFirst({
      where: { productionPlanRowId: rowId },
      orderBy: { createdAt: "desc" },
      select: { ticketNumber: true, status: true, createdAt: true },
    });
    const latestChange = await prisma.productionPlanRowChange.findFirst({
      where: { rowId },
      orderBy: { changedAt: "desc" },
      select: { changedAt: true },
    });
    if (!canCreateNewSetupTicket(latestTicket, latestChange?.changedAt ?? null)) {
      return {
        error: `A machine-setup ticket (${latestTicket!.ticketNumber}) already exists for this row.`,
      };
    }

    const productLabel = row.product?.name ?? "no product set";
    const description =
      `Mold change from Production Plan ${row.plan.formNumber}.\n` +
      `Target product: ${productLabel}.` +
      (row.statusInstruction ? `\nStatus: ${row.statusInstruction}` : "") +
      (row.referenceCycleTime ? `\nReference cycle time: ${row.referenceCycleTime}` : "");

    const ticketId = await prisma.$transaction(async (tx) => {
      const slaPolicy = await tx.slaPolicy.findUnique({ where: { priority: "MEDIUM" } });
      const now = Date.now();
      const ackDueAt = slaPolicy ? new Date(now + slaPolicy.ackMinutes * 60_000) : null;
      const resolveDueAt = slaPolicy
        ? new Date(now + slaPolicy.resolveMinutes * 60_000)
        : null;

      const ticket = await tx.ticket.create({
        data: {
          type: "MACHINE_SETUP",
          title: `Machine setup — ${row.asset.name}`,
          description,
          priority: "MEDIUM",
          requesterId: user.id,
          productionPlanRowId: row.id,
          targetProductId: row.productId,
          ticketNumber: await nextTicketNumber(tx),
          ackDueAt,
          resolveDueAt,
        },
      });
      await tx.ticketAsset.create({
        data: { ticketId: ticket.id, assetId: row.asset.id, flaggedById: user.id },
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

type TicketWithAssignments = Ticket & { assignments: { technicianId: string }[] };

type TransitionOptions = {
  data?: Prisma.TicketUpdateManyMutationInput;
  note?: string;
  /** Runs first inside the transaction — e.g. the technician busy-check. */
  guard?: (tx: Prisma.TransactionClient) => Promise<void>;
  /** Runs last inside the transaction, right after the history row — the
   *  notify hook for this transition. `ticket` is the pre-transition
   *  snapshot (already loaded with assignments); `actorId` is whoever ran it. */
  notify?: (
    tx: Prisma.TransactionClient,
    ticket: TicketWithAssignments,
    toStatus: TicketStatus,
    actorId: string
  ) => Promise<void>;
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
  const toStatus = transitionTarget(action, ticket.type);

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

    if (options.notify) await options.notify(tx, ticket, toStatus, user.id);
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
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { assets: { where: { unflaggedAt: null }, select: { assetId: true } } },
    });
    const assetIds = ticket?.assets.map((a) => a.assetId) ?? [];
    await runTransition(ticketId, "startWork", {
      data: ticket?.startedAt ? {} : { startedAt: new Date() },
      guard: async (tx) => {
        const busy = await findBusyTicket(tx, user.id, ticketId);
        if (busy) {
          throw new ConflictError(
            `Finish or hold ${busy.ticketNumber} before starting another ticket.`
          );
        }
        // A machine setup can't begin while the same machine still has an open
        // Preventive-Maintenance ticket — PM must finish first (plan §6).
        if (ticket?.type === "MACHINE_SETUP" && assetIds.length > 0) {
          const openPm = await tx.ticket.findFirst({
            where: {
              type: "PREVENTIVE_MAINTENANCE",
              status: { notIn: ["CLOSED", "CANCELLED"] },
              assets: { some: { unflaggedAt: null, assetId: { in: assetIds } } },
            },
            select: { ticketNumber: true },
          });
          if (openPm) {
            throw new ConflictError(
              `Finish the open Preventive Maintenance ticket ${openPm.ticketNumber} on this machine first.`
            );
          }
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

    await runTransition(ticketId, "resolveTicket", {
      data: { resolvedAt: new Date() },
      // Who needs to act next depends on the ticket type (plan §2 / RESOLVE_TARGET).
      notify: async (tx, ticket, _toStatus, actorId) => {
        const linkPath = `/tickets/${ticketId}`;
        if (ticket.type === "MAINTENANCE") {
          await createNotification(tx, ticket.requesterId, {
            type: "TICKET_VERIFY_REQUESTED",
            title: `${ticket.ticketNumber} needs your verification`,
            body: ticket.title,
            linkPath,
            actorId,
          });
        } else if (ticket.type === "PREVENTIVE_MAINTENANCE") {
          await notifyUsers(tx, await supervisors(tx), {
            type: "TICKET_REVIEW_REQUESTED",
            title: `${ticket.ticketNumber} ready for review`,
            body: ticket.title,
            linkPath,
            actorId,
          });
        } else if (ticket.type === "MACHINE_SETUP") {
          await notifyUsers(tx, await maintenanceLeads(tx), {
            type: "SETUP_MAINTENANCE_APPROVAL",
            title: `${ticket.ticketNumber} needs Maintenance approval`,
            body: ticket.title,
            linkPath,
            actorId,
          });
        }
      },
    });
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

    await runTransition(ticketId, "verifyTicket", {
      data: { verifiedAt: new Date() },
      notify: async (tx, ticket, _toStatus, actorId) => {
        await notifyUsers(tx, await supervisors(tx), {
          type: "TICKET_REVIEW_REQUESTED",
          title: `${ticket.ticketNumber} ready for review`,
          body: ticket.title,
          linkPath: `/tickets/${ticketId}`,
          actorId,
        });
      },
    });
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
      notify: async (tx, ticket, _toStatus, actorId) => {
        await notifyUsers(
          tx,
          ticket.assignments.map((a) => a.technicianId),
          {
            type: "TICKET_REOPENED",
            title: `${ticket.ticketNumber} reopened`,
            body: ticket.title,
            linkPath: `/tickets/${parsed.data.ticketId}`,
            actorId,
          }
        );
      },
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

    await runTransition(ticketId, "closeTicket", {
      data: { closedAt: new Date() },
      notify: async (tx, ticket, _toStatus, actorId) => {
        await notifyUsers(
          tx,
          [ticket.requesterId, ...ticket.assignments.map((a) => a.technicianId)],
          {
            type: "TICKET_CLOSED",
            title: `${ticket.ticketNumber} closed`,
            body: ticket.title,
            linkPath: `/tickets/${ticketId}`,
            actorId,
          }
        );
      },
    });
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
      notify: async (tx, ticket, _toStatus, actorId) => {
        await notifyUsers(
          tx,
          ticket.assignments.map((a) => a.technicianId),
          {
            type: "TICKET_REOPENED",
            title: `${ticket.ticketNumber} reopened`,
            body: ticket.title,
            linkPath: `/tickets/${parsed.data.ticketId}`,
            actorId,
          }
        );
      },
    });
    return { success: true };
  });
}

// ── Machine-Setup dual approval (sequential: Maintenance → QA) ─────────────
// approveSetupQa closes the ticket; Phase 6 additionally updates the
// machine's current product (mold) inside that same transition.

export async function approveSetupMaintenance(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const ticketId = ticketIdFrom(formData);
    if (!ticketId) return { error: "Missing ticket." };

    await runTransition(ticketId, "approveSetupMaintenance", {
      note: "Machine setup approved by Maintenance — awaiting QA sign-off.",
      notify: async (tx, ticket, _toStatus, actorId) => {
        await notifyUsers(tx, await qaLeads(tx), {
          type: "SETUP_QA_APPROVAL",
          title: `${ticket.ticketNumber} needs QA approval`,
          body: ticket.title,
          linkPath: `/tickets/${ticketId}`,
          actorId,
        });
      },
    });
    return { success: true };
  });
}

export async function approveSetupQa(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const ticketId = ticketIdFrom(formData);
    if (!ticketId) return { error: "Missing ticket." };

    const user = await requireActiveUser();
    // QA sign-off closes the ticket AND flips the machine's current mold to the
    // setup's target product — atomically, in the same transition transaction
    // (the changeover rolls back if the close guard fails).
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        targetProductId: true,
        assets: { where: { unflaggedAt: null }, select: { assetId: true }, take: 1 },
      },
    });
    const targetProductId = ticket?.targetProductId ?? null;
    const assetId = ticket?.assets[0]?.assetId ?? null;

    await runTransition(ticketId, "approveSetupQa", {
      data: { closedAt: new Date() },
      note: "Machine setup approved by QA — setup complete.",
      guard:
        targetProductId && assetId
          ? async (tx) => {
              await applyCurrentProduct(tx, {
                assetId,
                productId: targetProductId,
                changedById: user.id,
              });
            }
          : undefined,
      notify: async (tx, ticket, _toStatus, actorId) => {
        await notifyUsers(
          tx,
          [ticket.requesterId, ...ticket.assignments.map((a) => a.technicianId)],
          {
            type: "TICKET_CLOSED",
            title: `${ticket.ticketNumber} closed`,
            body: ticket.title,
            linkPath: `/tickets/${ticketId}`,
            actorId,
          }
        );
      },
    });
    return { success: true };
  });
}

export async function rejectSetup(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const parsed = rejectSetupSchema.safeParse({
      ticketId: formData.get("ticketId"),
      note: formData.get("note"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };

    await runTransition(parsed.data.ticketId, "rejectSetup", {
      data: { reopenCount: { increment: 1 } },
      note: parsed.data.note,
      notify: async (tx, ticket, _toStatus, actorId) => {
        await notifyUsers(
          tx,
          ticket.assignments.map((a) => a.technicianId),
          {
            type: "SETUP_REJECTED",
            title: `${ticket.ticketNumber} setup rejected`,
            body: ticket.title,
            linkPath: `/tickets/${parsed.data.ticketId}`,
            actorId,
          }
        );
      },
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
      notify: async (tx, ticket, _toStatus, actorId) => {
        await notifyUsers(
          tx,
          [ticket.requesterId, ...ticket.assignments.map((a) => a.technicianId)],
          {
            type: "TICKET_CANCELLED",
            title: `${ticket.ticketNumber} cancelled`,
            body: ticket.title,
            linkPath: `/tickets/${parsed.data.ticketId}`,
            actorId,
          }
        );
      },
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
      include: openAssignmentsInclude,
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
          await notifyUsers(
            tx,
            busyTicket.assignments.map((a) => a.technicianId),
            {
              type: "TICKET_ON_HOLD",
              title: `${busyTicket.ticketNumber} put on hold`,
              body: `Preempted by higher-priority ticket ${ticket.ticketNumber}`,
              linkPath: `/tickets/${busyTicket.id}`,
              actorId: admin.id,
            }
          );
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

      await notifyUsers(tx, technicianIds, {
        type: "TICKET_ASSIGNED",
        title: `${ticket.ticketNumber} assigned to you`,
        body: ticket.title,
        linkPath: `/tickets/${ticketId}`,
        actorId: admin.id,
      });
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

    const { toAdd, toRemove } = diffIds(ctx.assigneeIds, technicianIds);
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

      await notifyUsers(tx, toAdd, {
        type: "TICKET_ASSIGNED",
        title: `${ticket.ticketNumber} assigned to you`,
        body: ticket.title,
        linkPath: `/tickets/${ticketId}`,
        actorId: admin.id,
      });
      await notifyUsers(tx, toRemove, {
        type: "TICKET_UNASSIGNED",
        title: `Removed from ${ticket.ticketNumber}`,
        body: ticket.title,
        linkPath: `/tickets/${ticketId}`,
        actorId: admin.id,
      });
    });

    revalidatePath("/tickets");
    revalidatePath(`/tickets/${ticketId}`);
    return { success: true };
  });
}

// ── Asset flags ──────────────────────────────────────────────────────────
// A ticket is created against exactly one asset; afterward ADMIN/HEAD or an
// assigned technician can re-flag it to one or more (mirrors updateAssignees'
// flat-membership pattern, but for TicketAsset instead of TicketAssignment).

export async function updateTicketAssets(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const user = await requireActiveUser();
    const parsed = flagAssetsSchema.safeParse({
      ticketId: formData.get("ticketId"),
      assetIds: formData.getAll("assetIds"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { ticketId, assetIds } = parsed.data;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { ...openAssignmentsInclude, ...openAssetFlagsInclude },
    });
    if (!ticket) return { error: "Ticket not found." };
    const ctx = toTicketContext(ticket);
    assertCan(user, "reflagAssets", ctx);

    const currentAssetIds = ticket.assets.map((a) => a.assetId);
    const { toAdd, toRemove } = diffIds(currentAssetIds, assetIds);
    if (toAdd.length === 0 && toRemove.length === 0) {
      return { error: "No asset changes." };
    }

    const addedAssets = toAdd.length
      ? await prisma.asset.findMany({
          where: { id: { in: toAdd }, status: { not: "RETIRED" } },
          select: { id: true, assetCode: true },
        })
      : [];
    if (addedAssets.length !== toAdd.length) {
      return { error: "Pick non-retired assets only." };
    }

    await prisma.$transaction(async (tx) => {
      // Asset flag edit, not a status transition — the status itself is
      // rewritten unchanged just to drive the optimistic concurrency guard.
      const { count } = await tx.ticket.updateMany({
        where: { id: ticketId, status: ticket.status },
        data: { status: ticket.status },
      });
      if (count === 0) throw new ConflictError("Ticket changed state — refresh and retry.");

      if (toRemove.length > 0) {
        await tx.ticketAsset.updateMany({
          where: { ticketId, assetId: { in: toRemove }, unflaggedAt: null },
          data: { unflaggedAt: new Date() },
        });
      }
      if (toAdd.length > 0) {
        await tx.ticketAsset.createMany({
          data: toAdd.map((assetId) => ({ ticketId, assetId, flaggedById: user.id })),
        });
      }

      const removedSet = new Set(toRemove);
      const retainedCodes = ticket.assets
        .filter((a) => !removedSet.has(a.assetId))
        .map((a) => a.asset.assetCode);
      const codes = [...retainedCodes, ...addedAssets.map((a) => a.assetCode)].sort();

      await tx.ticketStatusHistory.create({
        data: {
          ticketId,
          fromStatus: ticket.status,
          toStatus: ticket.status,
          changedById: user.id,
          note: `Re-flagged to ${codes.join(", ")}`,
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

// ── Materials log (free text; every ticket type) ──────────────────────────
// Reuses the logPartUsed authz gate — an assignee may log/remove materials
// only while the ticket is IN_PROGRESS.

export async function logMaterial(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const user = await requireActiveUser();
    const parsed = logMaterialSchema.safeParse({
      ticketId: formData.get("ticketId"),
      name: formData.get("name"),
      quantity: formData.get("quantity"),
      unit: formData.get("unit"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { ticketId, name, quantity, unit } = parsed.data;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: openAssignmentsInclude,
    });
    if (!ticket) return { error: "Ticket not found." };
    assertCan(user, "logPartUsed", toTicketContext(ticket));

    await prisma.ticketMaterialLog.create({
      data: { ticketId, name, quantity, unit: unit ?? null, loggedById: user.id },
    });

    revalidatePath(`/tickets/${ticketId}`);
    return { success: true };
  });
}

export async function removeMaterial(
  _prevState: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  return runAction(async () => {
    const user = await requireActiveUser();
    const parsed = removeMaterialSchema.safeParse({
      ticketId: formData.get("ticketId"),
      materialId: formData.get("materialId"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { ticketId, materialId } = parsed.data;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: openAssignmentsInclude,
    });
    if (!ticket) return { error: "Ticket not found." };
    assertCan(user, "logPartUsed", toTicketContext(ticket));

    await prisma.ticketMaterialLog.deleteMany({ where: { id: materialId, ticketId } });

    revalidatePath(`/tickets/${ticketId}`);
    return { success: true };
  });
}
