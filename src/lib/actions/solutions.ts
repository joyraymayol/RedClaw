"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { solutionSchema } from "@/lib/validations/solution";

export type SolutionActionState = {
  error?: string;
  success?: boolean;
};

function parseForm(formData: FormData) {
  const machineId = formData.get("machineId");
  return solutionSchema.safeParse({
    problemTypeId: formData.get("problemTypeId"),
    machineId: machineId === "__general__" ? "" : machineId,
    title: formData.get("title"),
    description: formData.get("description"),
  });
}

export async function createSolution(
  _prevState: SolutionActionState,
  formData: FormData
): Promise<SolutionActionState> {
  const user = await requireRole("ADMIN", "HEAD");

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.solution.create({ data: { ...parsed.data, authorId: user.id } });

  revalidatePath("/knowledge-base");
  return { success: true };
}

export async function updateSolution(
  _prevState: SolutionActionState,
  formData: FormData
): Promise<SolutionActionState> {
  await requireRole("ADMIN", "HEAD");

  const solutionId = String(formData.get("solutionId") ?? "");
  if (!solutionId) return { error: "Missing solution." };

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { count } = await prisma.solution.updateMany({
    where: { id: solutionId },
    data: parsed.data,
  });
  if (count === 0) return { error: "Solution not found." };

  revalidatePath("/knowledge-base");
  return { success: true };
}
