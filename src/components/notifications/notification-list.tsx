"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markAllNotificationsRead, markNotificationRead } from "@/lib/actions/notifications";
import type { NotificationListItem } from "@/lib/notifications";

/** Full paginated inbox list — same click-to-read behavior as the bell
 *  dropdown, but as a standalone page rather than a menu. */
export function NotificationList({ items }: { items: NotificationListItem[] }) {
  const router = useRouter();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const hasUnread = items.some((n) => !n.readAt && !readIds.has(n.id));

  function handleItemClick(id: string, wasUnread: boolean) {
    if (!wasUnread) return;
    setReadIds((ids) => new Set(ids).add(id));
    startTransition(async () => {
      await markNotificationRead(id);
      router.refresh();
    });
  }

  function handleMarkAllRead() {
    setReadIds(new Set(items.map((n) => n.id)));
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {hasUnread && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            Mark all read
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-lg border py-16 text-center text-sm text-muted-foreground">
          You&apos;re all caught up.
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {items.map((n) => {
            const unread = !n.readAt && !readIds.has(n.id);
            return (
              <Link
                key={n.id}
                href={n.linkPath ?? "/notifications"}
                onClick={() => handleItemClick(n.id, unread)}
                className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    unread ? "bg-primary" : "bg-transparent"
                  )}
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("text-sm", unread ? "font-medium" : "text-foreground")}>
                      {n.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNowStrict(n.createdAt, { addSuffix: true })}
                    </span>
                  </div>
                  {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
