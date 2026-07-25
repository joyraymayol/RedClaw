"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  fetchRecentNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/actions/notifications";
import type { NotificationListItem } from "@/lib/notifications";

const POLL_INTERVAL_MS = 45_000;

/** Bell + unread badge + recent-10 dropdown, polling the unread count every 45s. */
export function NotificationBell({ userId }: { userId: string }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState<NotificationListItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      // Next.js aborts an in-flight Server Action call (rejecting with a
      // DOMException) when a route transition or Fast Refresh reload
      // supersedes it — harmless since the next interval tick retries.
      try {
        const count = await fetchUnreadCount();
        if (!cancelled) setUnreadCount(count);
      } catch {
        // ignore — transient, will retry on the next poll
      }
    }
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // Re-poll from zero if the signed-in user changes under this layout.
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchRecentNotifications()
      .then((items) => {
        if (!cancelled) setRecent(items);
      })
      .catch(() => {
        // ignore — same transient-abort reasoning as the poll above
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function handleItemClick(id: string, wasUnread: boolean) {
    if (!wasUnread) return;
    setRecent((items) =>
      items ? items.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n)) : items
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    startTransition(() => {
      markNotificationRead(id);
    });
  }

  function handleMarkAllRead() {
    setRecent((items) => (items ? items.map((n) => ({ ...n, readAt: n.readAt ?? new Date() })) : items));
    setUnreadCount(0);
    startTransition(() => {
      markAllNotificationsRead();
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full px-1 text-[10px]"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80 max-h-[70vh]">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">Notifications</span>
          {unreadCount > 0 && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllRead}
            >
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {recent === null ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            You&apos;re all caught up.
          </div>
        ) : (
          recent.map((n) => {
            const unread = !n.readAt;
            return (
              <DropdownMenuItem
                key={n.id}
                className="flex-col items-start gap-0.5 whitespace-normal py-2"
                render={<Link href={n.linkPath ?? "/notifications"} />}
                onClick={() => handleItemClick(n.id, unread)}
              >
                <div className="flex w-full items-center gap-2">
                  {unread && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                  <span className={cn("text-sm", unread ? "font-medium" : "text-muted-foreground")}>
                    {n.title}
                  </span>
                </div>
                {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                <span className="text-[11px] text-muted-foreground">
                  {formatDistanceToNowStrict(n.createdAt, { addSuffix: true })}
                </span>
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/notifications" />} className="justify-center text-sm">
          See all
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
