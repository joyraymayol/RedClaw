"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { machineSchema } from "@/lib/validations/machine";

export type MachineActionState = {
  error?: string;
  success?: boolean;
};

function parseMachineForm(formData: FormData) {
  return machineSchema.safeParse({
    assetCode: formData.get("assetCode"),
    name: formData.get("name"),
    category: formData.get("category"),
    location: formData.get("location"),
    status: formData.get("status"),
    notes: formData.get("notes"),
  });
}

export async function createMachine(
  _prevState: MachineActionState,
  formData: FormData
): Promise<MachineActionState> {
  await requireRole("ADMIN", "HEAD");

  const parsed = parseMachineForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await prisma.machine.create({ data: parsed.data });
  } catch (e) {
    if (isUniqueConstraintError(e, "assetCode")) {
      return { error: "A machine with that asset code already exists." };
    }
    throw e;
  }

  revalidatePath("/machines");
  return { success: true };
}

export async function updateMachine(
  _prevState: MachineActionState,
  formData: FormData
): Promise<MachineActionState> {
  await requireRole("ADMIN", "HEAD");

  const machineId = String(formData.get("machineId") ?? "");
  if (!machineId) return { error: "Missing machine." };

  const parsed = parseMachineForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const { count } = await prisma.machine.updateMany({
      where: { id: machineId },
      data: parsed.data,
    });
    if (count === 0) return { error: "Machine not found." };
  } catch (e) {
    if (isUniqueConstraintError(e, "assetCode")) {
      return { error: "A machine with that asset code already exists." };
    }
    throw e;
  }

  revalidatePath("/machines");
  revalidatePath(`/machines/${machineId}`);
  return { success: true };
}
