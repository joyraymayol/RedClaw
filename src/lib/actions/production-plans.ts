"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { runAction } from "@/lib/actions/action-helpers";
import { requireActiveUser, requireRole } from "@/lib/auth";
import { canPreparePlan, ForbiddenError } from "@/lib/authz";
import { maintenanceLeads, notifyUsers, planApprovers } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { openAssignmentsInclude } from "@/lib/ticket-context";
import {
  approverSchema,
  createProductionPlanSchema,
  updatePlanHeaderSchema,
  updatePlanRowSchema,
} from "@/lib/validations/production-plan";

export type PlanActionState = { error?: string; success?: boolean };

// ── Create ────────────────────────────────────────────────────────────────

export async function createProductionPlan(
  _prev: PlanActionState,
  formData: FormData
): Promise<PlanActionState> {
  const result = await runAction<PlanActionState & { planId?: string }>(async () => {
    const user = await requireActiveUser();
    if (!canPreparePlan(user)) {
      throw new ForbiddenError("Only Production staff may prepare a plan.");
    }

    let rawRows: unknown;
    try {
      rawRows = JSON.parse(String(formData.get("rows") ?? "[]"));
    } catch {
      return { error: "Couldn't read the machine rows." };
    }

    const parsed = createProductionPlanSchema.safeParse({
      formNumber: formData.get("formNumber"),
      scheduleFrom: formData.get("scheduleFrom"),
      scheduleTo: formData.get("scheduleTo"),
      effectiveDate: formData.get("effectiveDate"),
      rows: rawRows,
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { rows, ...header } = parsed.data;

    // Every row must target a live Production Machine, and any chosen product
    // must be one that machine is actually capable of running.
    const machines = await prisma.asset.findMany({
      where: { status: { not: "RETIRED" }, category: { tracksProducts: true } },
      select: { id: true, productCapabilities: { select: { productId: true } } },
    });
    const capsByMachine = new Map(
      machines.map((m) => [m.id, new Set(m.productCapabilities.map((c) => c.productId))])
    );
    for (const row of rows) {
      const caps = capsByMachine.get(row.assetId);
      if (!caps) return { error: "A row points to a machine that no longer exists." };
      if (row.productId && !caps.has(row.productId)) {
        return { error: "Choose a product each machine is capable of running." };
      }
    }

    const plan = await prisma.productionPlan.create({
      data: {
        ...header,
        preparedById: user.id,
        rows: {
          create: rows.map((r, i) => ({
            assetId: r.assetId,
            statusInstruction: r.statusInstruction,
            productId: r.productId ?? null,
            referenceCycleTime: r.referenceCycleTime,
            remarks: r.remarks,
            sortOrder: i,
          })),
        },
      },
      select: { id: true },
    });

    return { success: true, planId: plan.id };
  });

  if (result.success && result.planId) {
    revalidatePath("/production-plans");
    redirect(`/production-plans/${result.planId}`);
  }
  return result;
}

// ── Header edit (DRAFT / PENDING_APPROVAL) ──────────────────────────────────

export async function updatePlanHeader(
  _prev: PlanActionState,
  formData: FormData
): Promise<PlanActionState> {
  const result = await runAction<PlanActionState & { planId?: string }>(async () => {
    const user = await requireActiveUser();
    if (!canPreparePlan(user)) {
      throw new ForbiddenError("Only Production staff may edit a plan.");
    }

    const parsed = updatePlanHeaderSchema.safeParse({
      planId: formData.get("planId"),
      formNumber: formData.get("formNumber"),
      scheduleFrom: formData.get("scheduleFrom"),
      scheduleTo: formData.get("scheduleTo"),
      effectiveDate: formData.get("effectiveDate"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { planId, ...header } = parsed.data;

    const plan = await prisma.productionPlan.findUnique({
      where: { id: planId },
      select: { status: true },
    });
    if (!plan) return { error: "Plan not found." };
    if (plan.status === "APPROVED") {
      return { error: "An approved plan's header is locked." };
    }

    await prisma.productionPlan.update({ where: { id: planId }, data: header });
    return { success: true, planId };
  });

  if (result.success && result.planId) {
    revalidatePath(`/production-plans/${result.planId}`);
  }
  return result;
}

// ── Submit for approval (DRAFT → PENDING_APPROVAL) ──────────────────────────

export async function submitPlan(planId: string): Promise<PlanActionState> {
  return runAction(async () => {
    const user = await requireActiveUser();
    if (!canPreparePlan(user)) {
      throw new ForbiddenError("Only Production staff may submit a plan.");
    }

    const outcome = await prisma.$transaction(async (tx): Promise<PlanActionState> => {
      const { count } = await tx.productionPlan.updateMany({
        where: { id: planId, status: "DRAFT" },
        data: { status: "PENDING_APPROVAL" },
      });
      if (count === 0) return { error: "Only a draft plan can be submitted." };

      const plan = await tx.productionPlan.findUnique({
        where: { id: planId },
        select: { formNumber: true },
      });
      await notifyUsers(tx, await planApprovers(tx), {
        type: "PLAN_APPROVAL_REQUESTED",
        title: `Plan ${plan?.formNumber} needs approval`,
        linkPath: `/production-plans/${planId}`,
        actorId: user.id,
      });
      return { success: true };
    });

    if (outcome.success) {
      revalidatePath(`/production-plans/${planId}`);
      revalidatePath("/production-plans");
    }
    return outcome;
  });
}

// ── Approve (any designated approver: PENDING_APPROVAL → APPROVED + freeze) ──

export async function approvePlan(planId: string): Promise<PlanActionState> {
  return runAction(async () => {
    const user = await requireActiveUser();
    const isApprover = await prisma.productionPlanApprover.findUnique({
      where: { userId: user.id },
      select: { userId: true },
    });
    if (!isApprover) {
      throw new ForbiddenError("Only a designated approver may approve a plan.");
    }

    const now = new Date();
    const outcome = await prisma.$transaction(async (tx): Promise<PlanActionState> => {
      const plan = await tx.productionPlan.findUnique({
        where: { id: planId },
        include: { rows: true },
      });
      if (!plan) return { error: "Plan not found." };
      if (plan.status !== "PENDING_APPROVAL") {
        return { error: "This plan isn't awaiting approval." };
      }

      // Optimistic guard against a concurrent approval.
      const { count } = await tx.productionPlan.updateMany({
        where: { id: planId, status: "PENDING_APPROVAL" },
        data: { status: "APPROVED", approvedById: user.id, approvedAt: now, frozenAt: now },
      });
      if (count === 0) return { error: "This plan was just approved by someone else." };

      // Freeze each row's "initial request", capturing the product name too so
      // a later rename doesn't rewrite the frozen record.
      const productIds = [
        ...new Set(plan.rows.map((r) => r.productId).filter((id): id is string => !!id)),
      ];
      const products = productIds.length
        ? await tx.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true },
          })
        : [];
      const nameOf = (id: string | null) =>
        id ? (products.find((p) => p.id === id)?.name ?? null) : null;

      for (const row of plan.rows) {
        await tx.productionPlanRow.update({
          where: { id: row.id },
          data: {
            approvedSnapshot: {
              statusInstruction: row.statusInstruction,
              productId: row.productId,
              productName: nameOf(row.productId),
              referenceCycleTime: row.referenceCycleTime,
              remarks: row.remarks,
            },
          },
        });
      }

      await notifyUsers(tx, [...(await maintenanceLeads(tx)), plan.preparedById], {
        type: "PLAN_APPROVED",
        title: `Plan ${plan.formNumber} approved`,
        linkPath: `/production-plans/${planId}`,
        actorId: user.id,
      });

      return { success: true };
    });

    if (outcome.success) {
      revalidatePath(`/production-plans/${planId}`);
      revalidatePath("/production-plans");
    }
    return outcome;
  });
}

// ── Row edit (post-approval edits append a change-log entry) ────────────────

export async function updatePlanRow(
  _prev: PlanActionState,
  formData: FormData
): Promise<PlanActionState> {
  return runAction(async () => {
    const user = await requireActiveUser();
    if (!canPreparePlan(user)) {
      throw new ForbiddenError("Only Production staff may edit a plan.");
    }

    const parsed = updatePlanRowSchema.safeParse({
      rowId: formData.get("rowId"),
      statusInstruction: formData.get("statusInstruction"),
      productId: formData.get("productId"),
      referenceCycleTime: formData.get("referenceCycleTime"),
      remarks: formData.get("remarks"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { rowId, statusInstruction, referenceCycleTime, remarks } = parsed.data;
    const nextProductId = parsed.data.productId ?? null;

    const row = await prisma.productionPlanRow.findUnique({
      where: { id: rowId },
      include: {
        plan: { select: { id: true, status: true, formNumber: true } },
        asset: { select: { productCapabilities: { select: { productId: true } } } },
        tickets: {
          where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
          include: openAssignmentsInclude,
        },
      },
    });
    if (!row) return { error: "Row not found." };
    if (
      nextProductId &&
      !row.asset.productCapabilities.some((c) => c.productId === nextProductId)
    ) {
      return { error: "Choose a product this machine is capable of running." };
    }

    // Build a human-readable change log for approved plans only (before
    // approval nothing is frozen, so edits are just draft refinements).
    const changes: { field: string; oldValue: string; newValue: string }[] = [];
    if (row.plan.status === "APPROVED") {
      let oldProductLabel = "—";
      let newProductLabel = "—";
      const ids = [row.productId, nextProductId].filter((id): id is string => !!id);
      if (ids.length > 0) {
        const products = await prisma.product.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        });
        const nameOf = (id: string | null) =>
          id ? (products.find((p) => p.id === id)?.name ?? "—") : "—";
        oldProductLabel = nameOf(row.productId);
        newProductLabel = nameOf(nextProductId);
      }
      if (row.statusInstruction !== statusInstruction) {
        changes.push({
          field: "Status",
          oldValue: row.statusInstruction || "—",
          newValue: statusInstruction || "—",
        });
      }
      if (row.productId !== nextProductId) {
        changes.push({ field: "Product", oldValue: oldProductLabel, newValue: newProductLabel });
      }
      if (row.referenceCycleTime !== referenceCycleTime) {
        changes.push({
          field: "Reference cycle time",
          oldValue: row.referenceCycleTime || "—",
          newValue: referenceCycleTime || "—",
        });
      }
      if (row.remarks !== remarks) {
        changes.push({ field: "Remarks", oldValue: row.remarks || "—", newValue: remarks || "—" });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.productionPlanRow.update({
        where: { id: rowId },
        data: { statusInstruction, productId: nextProductId, referenceCycleTime, remarks },
      });
      if (changes.length > 0) {
        await tx.productionPlanRowChange.createMany({
          data: changes.map((c) => ({ rowId, changedById: user.id, ...c })),
        });

        const assigneeIds = row.tickets.flatMap((t) => t.assignments.map((a) => a.technicianId));
        await notifyUsers(tx, [...(await maintenanceLeads(tx)), ...assigneeIds], {
          type: "PLAN_ROW_CHANGED",
          title: `Plan ${row.plan.formNumber} row changed`,
          linkPath: `/production-plans/${row.plan.id}`,
          actorId: user.id,
        });
      }
    });

    revalidatePath(`/production-plans/${row.plan.id}`);
    return { success: true };
  });
}

// ── Delete a draft ──────────────────────────────────────────────────────────

export async function deletePlan(planId: string): Promise<PlanActionState> {
  const result = await runAction(async () => {
    const user = await requireActiveUser();
    if (!canPreparePlan(user)) {
      throw new ForbiddenError("Only Production staff may delete a plan.");
    }
    const { count } = await prisma.productionPlan.deleteMany({
      where: { id: planId, status: "DRAFT" },
    });
    if (count === 0) return { error: "Only a draft plan can be deleted." };
    return { success: true };
  });
  if (result.success) {
    revalidatePath("/production-plans");
    redirect("/production-plans");
  }
  return result;
}

// ── Designated-approver management (ADMIN / HEAD) ────────────────────────────

export async function addApprover(
  _prev: PlanActionState,
  formData: FormData
): Promise<PlanActionState> {
  return runAction(async () => {
    await requireRole("ADMIN", "HEAD");
    const parsed = approverSchema.safeParse({ userId: formData.get("userId") });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    await prisma.productionPlanApprover.upsert({
      where: { userId: parsed.data.userId },
      update: {},
      create: { userId: parsed.data.userId },
    });
    revalidatePath("/production-plans/approvers");
    return { success: true };
  });
}

export async function removeApprover(userId: string): Promise<PlanActionState> {
  return runAction<PlanActionState>(async () => {
    await requireRole("ADMIN", "HEAD");
    await prisma.productionPlanApprover.deleteMany({ where: { userId } });
    revalidatePath("/production-plans/approvers");
    return { success: true };
  });
}
