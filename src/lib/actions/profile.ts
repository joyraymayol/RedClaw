"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { departmentSchema, positionSchema } from "@/lib/constants/org";
import { prisma } from "@/lib/prisma";

export type ProfileFormState = {
  error?: string;
};

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(80),
  department: departmentSchema,
  position: positionSchema,
});

export async function completeProfile(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    department: formData.get("department"),
    position: formData.get("position"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Guarded by status so a stale re-submit can't touch an already
  // reviewed/approved account.
  await prisma.user.updateMany({
    where: { id: user.id, status: "PENDING_PROFILE" },
    data: { ...parsed.data, status: "PENDING_APPROVAL" },
  });

  redirect("/pending-approval");
}
