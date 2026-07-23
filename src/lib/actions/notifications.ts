"use server";

import { revalidatePath } from "next/cache";

import { requireActiveUser } from "@/lib/auth";
import {
  getUnreadCount,
  listRecentNotifications,
  type NotificationListItem,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export type NotificationActionState = {
  error?: string;
  success?: boolean;
};

/**
 * Poll target for the bell — the signed-in user's unread count. Derives the
 * user from the session; never trust a client-supplied id.
 */
export async function fetchUnreadCount(): Promise<number> {
  const user = await requireActiveUser();
  return getUnreadCount(user.id);
}

/** Recent notifications for the bell dropdown (signed-in user only). */
export async function fetchRecentNotifications(): Promise<NotificationListItem[]> {
  const user = await requireActiveUser();
  return listRecentNotifications(user.id);
}

/** Mark one of the caller's notifications read (scoped to their own rows). */
export async function markNotificationRead(
  notificationId: string
): Promise<NotificationActionState> {
  const user = await requireActiveUser();
  if (!notificationId) return { error: "Missing notification." };
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
  return { success: true };
}

/** Mark all of the caller's unread notifications read. */
export async function markAllNotificationsRead(): Promise<NotificationActionState> {
  const user = await requireActiveUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
  return { success: true };
}
