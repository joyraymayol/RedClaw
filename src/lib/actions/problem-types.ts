"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isForeignKeyConstraintError, isUniqueConstraintError } from "@/lib/prisma-errors";
import { problemTypeSchema } from "@/lib/validations/problem-type";

export type ProblemTypeActionState = {
  error?: string;
  success?: boolean;
};

function parseForm(formData: FormData) {
  return problemTypeSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    description: formData.get("description"),
  });
}

export async function createProblemType(
  _prevState: ProblemTypeActionState,
  formData: FormData
): Promise<ProblemTypeActionState> {
  await requireRole("ADMIN", "HEAD");

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await prisma.problemType.create({ data: parsed.data });
  } catch (e) {
    if (isUniqueConstraintError(e, "name")) {
      return { error: "A problem type with that name already exists." };
    }
    throw e;
  }

  revalidatePath("/knowledge-base");
  return { success: true };
}

export async function deleteProblemType(problemTypeId: string): Promise<ProblemTypeActionState> {
  await requireRole("ADMIN", "HEAD");
  if (!problemTypeId) return { error: "Missing problem type." };

  try {
    await prisma.problemType.delete({ where: { id: problemTypeId } });
  } catch (e) {
    if (isForeignKeyConstraintError(e)) {
      return {
        error:
          "Can't delete — this problem type is still referenced by existing tickets or solutions.",
      };
    }
    throw e;
  }

  revalidatePath("/knowledge-base");
  return { success: true };
}

export async function updateProblemType(
  _prevState: ProblemTypeActionState,
  formData: FormData
): Promise<ProblemTypeActionState> {
  await requireRole("ADMIN", "HEAD");

  const problemTypeId = String(formData.get("problemTypeId") ?? "");
  if (!problemTypeId) return { error: "Missing problem type." };

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const { count } = await prisma.problemType.updateMany({
      where: { id: problemTypeId },
      data: parsed.data,
    });
    if (count === 0) return { error: "Problem type not found." };
  } catch (e) {
    if (isUniqueConstraintError(e, "name")) {
      return { error: "A problem type with that name already exists." };
    }
    throw e;
  }

  revalidatePath("/knowledge-base");
  return { success: true };
}
