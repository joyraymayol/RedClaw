"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/lib/actions/action-helpers";
import { requireActiveUser, requireRole } from "@/lib/auth";
import { assertCan } from "@/lib/authz";
import { diffIds } from "@/lib/id-diff";
import { prisma } from "@/lib/prisma";
import { isForeignKeyConstraintError, isUniqueConstraintError } from "@/lib/prisma-errors";
import { openAssignmentsInclude, toTicketContext } from "@/lib/ticket-context";
import {
  checklistResultSchema,
  pmChecklistItemSchema,
  pmChecklistTemplateSchema,
  templateAssetsSchema,
} from "@/lib/validations/pm-checklist";

export type PmChecklistActionState = {
  error?: string;
  success?: boolean;
};

// Maintenance leads prepare these — ADMIN/HEAD/SUPERVISOR.
const MANAGER_ROLES = ["ADMIN", "HEAD", "SUPERVISOR"] as const;

// ── Templates ─────────────────────────────────────────────────────────────

export async function createPmChecklistTemplate(
  _prevState: PmChecklistActionState,
  formData: FormData
): Promise<PmChecklistActionState> {
  await requireRole(...MANAGER_ROLES);

  const parsed = pmChecklistTemplateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await prisma.pmChecklistTemplate.create({ data: parsed.data });
  } catch (e) {
    if (isUniqueConstraintError(e, "name")) {
      return { error: "A checklist with that name already exists." };
    }
    throw e;
  }

  revalidatePath("/pm-checklists");
  return { success: true };
}

export async function updatePmChecklistTemplate(
  _prevState: PmChecklistActionState,
  formData: FormData
): Promise<PmChecklistActionState> {
  await requireRole(...MANAGER_ROLES);

  const templateId = String(formData.get("templateId") ?? "");
  if (!templateId) return { error: "Missing checklist." };

  const parsed = pmChecklistTemplateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const { count } = await prisma.pmChecklistTemplate.updateMany({
      where: { id: templateId },
      data: parsed.data,
    });
    if (count === 0) return { error: "Checklist not found." };
  } catch (e) {
    if (isUniqueConstraintError(e, "name")) {
      return { error: "A checklist with that name already exists." };
    }
    throw e;
  }

  revalidatePath("/pm-checklists");
  return { success: true };
}

export async function deletePmChecklistTemplate(
  templateId: string
): Promise<PmChecklistActionState> {
  await requireRole(...MANAGER_ROLES);
  if (!templateId) return { error: "Missing checklist." };

  try {
    // Items and asset assignments cascade, so a template in use by machines
    // can still be deleted.
    await prisma.pmChecklistTemplate.delete({ where: { id: templateId } });
  } catch (e) {
    if (isForeignKeyConstraintError(e)) {
      return { error: "Can't delete this checklist while it's in use." };
    }
    throw e;
  }

  revalidatePath("/pm-checklists");
  revalidatePath("/assets");
  return { success: true };
}

// ── Asset assignments (template-side edit of the many-to-many) ─────────────

export async function updateTemplateAssets(
  _prevState: PmChecklistActionState,
  formData: FormData
): Promise<PmChecklistActionState> {
  await requireRole(...MANAGER_ROLES);

  const parsed = templateAssetsSchema.safeParse({
    templateId: formData.get("templateId"),
    assetIds: formData.getAll("assetIds"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { templateId, assetIds } = parsed.data;

  const template = await prisma.pmChecklistTemplate.findUnique({
    where: { id: templateId },
    include: { assetAssignments: true },
  });
  if (!template) return { error: "Checklist not found." };

  const { toAdd, toRemove } = diffIds(
    template.assetAssignments.map((a) => a.assetId),
    assetIds
  );
  if (toAdd.length === 0 && toRemove.length === 0) {
    return { error: "No asset changes." };
  }

  await prisma.$transaction(async (tx) => {
    if (toRemove.length > 0) {
      await tx.assetPmChecklistTemplate.deleteMany({
        where: { templateId, assetId: { in: toRemove } },
      });
    }
    if (toAdd.length > 0) {
      await tx.assetPmChecklistTemplate.createMany({
        data: toAdd.map((assetId) => ({ templateId, assetId })),
      });
    }
  });

  revalidatePath("/pm-checklists");
  revalidatePath("/assets");
  return { success: true };
}

// ── Items ─────────────────────────────────────────────────────────────────

export async function createPmChecklistItem(
  _prevState: PmChecklistActionState,
  formData: FormData
): Promise<PmChecklistActionState> {
  await requireRole(...MANAGER_ROLES);

  const parsed = pmChecklistItemSchema.safeParse({
    templateId: formData.get("templateId"),
    label: formData.get("label"),
    sortOrder: formData.get("sortOrder") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { templateId, label, sortOrder } = parsed.data;

  // Default sortOrder to the end of the list when unspecified.
  const order =
    sortOrder ??
    ((await prisma.pmChecklistTemplateItem.count({ where: { templateId } })) as number);

  await prisma.pmChecklistTemplateItem.create({
    data: { templateId, label, sortOrder: order },
  });

  revalidatePath("/pm-checklists");
  return { success: true };
}

export async function updatePmChecklistItem(
  _prevState: PmChecklistActionState,
  formData: FormData
): Promise<PmChecklistActionState> {
  await requireRole(...MANAGER_ROLES);

  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return { error: "Missing item." };

  const parsed = pmChecklistItemSchema.safeParse({
    templateId: formData.get("templateId"),
    label: formData.get("label"),
    sortOrder: formData.get("sortOrder") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { count } = await prisma.pmChecklistTemplateItem.updateMany({
    where: { id: itemId },
    data: { label: parsed.data.label, ...(parsed.data.sortOrder !== undefined && { sortOrder: parsed.data.sortOrder }) },
  });
  if (count === 0) return { error: "Item not found." };

  revalidatePath("/pm-checklists");
  return { success: true };
}

export async function deletePmChecklistItem(itemId: string): Promise<PmChecklistActionState> {
  await requireRole(...MANAGER_ROLES);
  if (!itemId) return { error: "Missing item." };

  await prisma.pmChecklistTemplateItem.delete({ where: { id: itemId } });
  revalidatePath("/pm-checklists");
  return { success: true };
}

// ── Per-ticket checklist result (technician fills these) ───────────────────

export async function updateChecklistResult(
  _prevState: PmChecklistActionState,
  formData: FormData
): Promise<PmChecklistActionState> {
  return runAction(async () => {
    const user = await requireActiveUser();
    const parsed = checklistResultSchema.safeParse({
      ticketId: formData.get("ticketId"),
      resultId: formData.get("resultId"),
      done: formData.get("done"),
      remark: formData.get("remark"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { ticketId, resultId, done, remark } = parsed.data;

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: openAssignmentsInclude,
    });
    if (!ticket) return { error: "Ticket not found." };
    // Same gate as logging parts: an assignee, while the ticket is in progress.
    assertCan(user, "logPartUsed", toTicketContext(ticket));

    const { count } = await prisma.ticketChecklistResult.updateMany({
      where: { id: resultId, ticketId },
      data: {
        done,
        remark: remark ?? null,
        checkedById: user.id,
        checkedAt: new Date(),
      },
    });
    if (count === 0) return { error: "Checklist item not found." };

    revalidatePath(`/tickets/${ticketId}`);
    return { success: true };
  });
}
