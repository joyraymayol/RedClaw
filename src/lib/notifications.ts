import type { Prisma } from "@/generated/prisma/client";
import type { NotificationType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * In-app notification emit + read helpers.
 *
 * The emit helpers take a transaction client so a notification is written in
 * the SAME `$transaction` as the state change that triggers it — if the action
 * commits, the notification commits with it; if it rolls back, no stray notice.
 * Content (`title`/`body`/`linkPath`) is rendered by the caller at emit time
 * and denormalized, so the bell and list never re-join the source row.
 *
 * The recipient resolvers mirror the authz gates (isMaintenanceHigher /
 * isQaHigher / plan-approver membership) so the people notified are exactly the
 * people allowed to act on the handoff.
 */

/** The rendered content of a notification, written at emit time. */
export type NotifyPayload = {
  type: NotificationType;
  title: string;
  body?: string | null;
  linkPath?: string | null;
  /** Who triggered it — used to skip self-notifications and stamp `actorId`. */
  actorId?: string | null;
};

/**
 * Emit one notification inside an existing transaction. No-op when the
 * recipient is the actor — you never get notified about your own action.
 */
export async function createNotification(
  tx: Prisma.TransactionClient,
  userId: string,
  payload: NotifyPayload
): Promise<void> {
  if (payload.actorId && userId === payload.actorId) return;
  await tx.notification.create({
    data: {
      userId,
      actorId: payload.actorId ?? null,
      type: payload.type,
      title: payload.title,
      body: payload.body ?? null,
      linkPath: payload.linkPath ?? null,
    },
  });
}

/**
 * Fan one payload out to many recipients, de-duplicated and with the actor
 * dropped. No-op when nobody is left to notify.
 */
export async function notifyUsers(
  tx: Prisma.TransactionClient,
  userIds: readonly string[],
  payload: NotifyPayload
): Promise<void> {
  const recipients = [...new Set(userIds)].filter(
    (id) => !(payload.actorId && id === payload.actorId)
  );
  if (recipients.length === 0) return;
  await tx.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      actorId: payload.actorId ?? null,
      type: payload.type,
      title: payload.title,
      body: payload.body ?? null,
      linkPath: payload.linkPath ?? null,
    })),
  });
}

// ── Recipient resolvers ────────────────────────────────────────────────────

async function activeUserIds(
  tx: Prisma.TransactionClient,
  where: Prisma.UserWhereInput
): Promise<string[]> {
  const users = await tx.user.findMany({
    where: { status: "ACTIVE", ...where },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/** ADMIN + HEAD — the people who triage and assign new tickets. */
export function adminRecipients(tx: Prisma.TransactionClient): Promise<string[]> {
  return activeUserIds(tx, { role: { in: ["ADMIN", "HEAD"] } });
}

/** Maintenance leads (Maintenance HEAD/SUPERVISOR) plus any ADMIN — mirrors `isMaintenanceHigher`. */
export function maintenanceLeads(tx: Prisma.TransactionClient): Promise<string[]> {
  return activeUserIds(tx, {
    OR: [
      { role: "ADMIN" },
      { department: "MAINTENANCE", role: { in: ["HEAD", "SUPERVISOR"] } },
    ],
  });
}

/** Every active Maintenance-department user, any role — since any of them
 *  can self-assign to a ticket, all of them need to know one exists, not
 *  just the leads who used to be the only ones who could hand it out. */
export function maintenanceStaff(tx: Prisma.TransactionClient): Promise<string[]> {
  return activeUserIds(tx, { department: "MAINTENANCE" });
}

/** QA leads (QA HEAD/SUPERVISOR) plus any ADMIN — mirrors `isQaHigher`. */
export function qaLeads(tx: Prisma.TransactionClient): Promise<string[]> {
  return activeUserIds(tx, {
    OR: [
      { role: "ADMIN" },
      { department: "QUALITY_ASSURANCE", role: { in: ["HEAD", "SUPERVISOR"] } },
    ],
  });
}

/** Any SUPERVISOR or HEAD, department-agnostic — mirrors the `closeTicket` /
 *  `rejectReview` authz gate exactly (which, unlike isMaintenanceHigher /
 *  isQaHigher, has no ADMIN bypass and no department scoping). */
export function supervisors(tx: Prisma.TransactionClient): Promise<string[]> {
  return activeUserIds(tx, { role: { in: ["SUPERVISOR", "HEAD"] } });
}

/** The managed set of designated Production-Plan approvers (active only). */
export async function planApprovers(tx: Prisma.TransactionClient): Promise<string[]> {
  const rows = await tx.productionPlanApprover.findMany({
    where: { user: { status: "ACTIVE" } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

// ── Read helpers (server-side; callers pass a trusted userId) ───────────────

export type NotificationListItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  linkPath: string | null;
  readAt: Date | null;
  createdAt: Date;
};

const listSelect = {
  id: true,
  type: true,
  title: true,
  body: true,
  linkPath: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

/** Unread count for the bell badge. */
export function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/** Total count for the `/notifications` page's pagination (unread or all). */
export function countNotifications(
  userId: string,
  { unreadOnly = false }: { unreadOnly?: boolean } = {}
): Promise<number> {
  return prisma.notification.count({
    where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
  });
}

/** Recent notifications for the bell dropdown, newest first. */
export function listRecentNotifications(
  userId: string,
  take = 10
): Promise<NotificationListItem[]> {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: listSelect,
  });
}

/** Paginated inbox for the `/notifications` page. */
export async function listNotifications(
  userId: string,
  { skip, take, unreadOnly = false }: { skip: number; take: number; unreadOnly?: boolean }
): Promise<{ items: NotificationListItem[]; total: number }> {
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(unreadOnly ? { readAt: null } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: listSelect,
    }),
    prisma.notification.count({ where }),
  ]);
  return { items, total };
}
