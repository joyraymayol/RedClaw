"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type AdminActionState = {
  error?: string;
  success?: boolean;
};

const assignRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["REQUESTER", "TECHNICIAN", "ADMIN", "SUPERVISOR", "HEAD"]),
});

/**
 * Approve a pending user (or re-activate / re-role an existing one).
 * Users who haven't completed their profile yet can't be approved.
 */
export async function assignRole(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const admin = await requireRole("ADMIN", "HEAD");

  const parsed = assignRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: "Pick a role first." };
  }
  if (parsed.data.userId === admin.id) {
    return { error: "You can't change your own role." };
  }

  const { count } = await prisma.user.updateMany({
    where: {
      id: parsed.data.userId,
      status: { in: ["PENDING_APPROVAL", "ACTIVE", "DISABLED"] },
    },
    data: { role: parsed.data.role, status: "ACTIVE", isActive: true },
  });
  if (count === 0) {
    return { error: "User not found or profile not completed yet." };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function disableUser(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const admin = await requireRole("ADMIN", "HEAD");

  const userId = z.string().min(1).safeParse(formData.get("userId"));
  if (!userId.success) {
    return { error: "Missing user." };
  }
  if (userId.data === admin.id) {
    return { error: "You can't disable your own account." };
  }

  await prisma.user.updateMany({
    where: { id: userId.data },
    data: { status: "DISABLED", isActive: false },
  });

  revalidatePath("/admin/users");
  return { success: true };
}
