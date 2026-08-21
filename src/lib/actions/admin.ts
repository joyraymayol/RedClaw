"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { canManageUser } from "@/lib/authz";
import { departmentSchema, positionSchema } from "@/lib/constants/org";
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
 * Users who haven't completed their profile yet can't be approved. ADMIN may
 * act on anyone; a HEAD only on users in their own department (canManageUser).
 */
export async function assignRole(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const actor = await requireRole("ADMIN", "HEAD");

  const parsed = assignRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: "Pick a role first." };
  }
  if (parsed.data.userId === actor.id) {
    return { error: "You can't change your own role." };
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { department: true },
  });
  if (!target) return { error: "User not found or profile not completed yet." };
  if (!canManageUser(actor, target)) {
    return { error: "You don't have permission to manage this user." };
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
  const actor = await requireRole("ADMIN", "HEAD");

  const userId = z.string().min(1).safeParse(formData.get("userId"));
  if (!userId.success) {
    return { error: "Missing user." };
  }
  if (userId.data === actor.id) {
    return { error: "You can't disable your own account." };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId.data },
    select: { department: true },
  });
  if (!target) return { error: "User not found." };
  if (!canManageUser(actor, target)) {
    return { error: "You don't have permission to manage this user." };
  }

  await prisma.user.updateMany({
    where: { id: userId.data },
    data: { status: "DISABLED", isActive: false },
  });

  revalidatePath("/admin/users");
  return { success: true };
}

const updateUserProfileSchema = z.object({
  userId: z.string().min(1),
  position: positionSchema,
  department: departmentSchema.optional(),
});

/**
 * Edit an existing user's position and (ADMIN only) department. ADMIN may act
 * on anyone; a HEAD only on users in their own department (canManageUser) —
 * and a HEAD can never change department regardless of whose account it is,
 * since the field is disabled client-side and simply never submitted, but the
 * server double-checks that too rather than trusting the disabled control.
 */
export async function updateUserProfile(
  _prevState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const actor = await requireRole("ADMIN", "HEAD");

  const parsed = updateUserProfileSchema.safeParse({
    userId: formData.get("userId"),
    position: formData.get("position"),
    department: formData.get("department") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { userId, position, department } = parsed.data;
  if (userId === actor.id) {
    return { error: "You can't edit your own profile here." };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { department: true },
  });
  if (!target) return { error: "User not found." };
  if (!canManageUser(actor, target)) {
    return { error: "You don't have permission to manage this user." };
  }
  if (department && department !== target.department && actor.role !== "ADMIN") {
    return { error: "Only admins may change department." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      position,
      ...(actor.role === "ADMIN" && department ? { department } : {}),
    },
  });

  revalidatePath("/admin/users");
  return { success: true };
}
