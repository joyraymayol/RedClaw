import type { Metadata } from "next";
import Link from "next/link";

import { NotificationList } from "@/components/notifications/notification-list";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { PerPageSelect } from "@/components/ui/per-page-select";
import { DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from "@/lib/constants/pagination";
import { requireActiveUser } from "@/lib/auth";
import { countNotifications, getUnreadCount, listNotifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

function href(params: { unread: boolean; perPage: number }, page?: number) {
  const search = new URLSearchParams();
  if (params.unread) search.set("unread", "1");
  if (params.perPage !== DEFAULT_PER_PAGE) search.set("perPage", String(params.perPage));
  if (page && page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `/notifications?${query}` : "/notifications";
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ unread?: string; page?: string; perPage?: string }>;
}) {
  const user = await requireActiveUser();
  const { unread: unreadParam, page: pageParam, perPage: perPageParamRaw } = await searchParams;
  const unreadOnly = unreadParam === "1";
  const perPageParam = Number(perPageParamRaw);
  const perPage = (PER_PAGE_OPTIONS as readonly number[]).includes(perPageParam)
    ? perPageParam
    : DEFAULT_PER_PAGE;

  const [unreadCount, totalForScope] = await Promise.all([
    getUnreadCount(user.id),
    countNotifications(user.id, { unreadOnly }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalForScope / perPage));
  const page = Math.min(Math.max(Math.floor(Number(pageParam)) || 1, 1), totalPages);

  const { items, total } = await listNotifications(user.id, {
    skip: (page - 1) * perPage,
    take: perPage,
    unreadOnly,
  });

  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, total);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">Everything that&apos;s needed your attention.</p>
      </div>

      <div className="flex items-center gap-1">
        <Link
          href={href({ unread: false, perPage })}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-sm transition-colors",
            !unreadOnly
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          All
        </Link>
        <Link
          href={href({ unread: true, perPage })}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
            unreadOnly
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Unread
          {unreadCount > 0 && (
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                unreadOnly ? "bg-background" : "bg-muted-foreground/10"
              )}
            >
              {unreadCount}
            </span>
          )}
        </Link>
      </div>

      <NotificationList items={items} />

      {total > 0 && (
        <PaginationBar
          total={total}
          page={page}
          totalPages={totalPages}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          itemLabel="notification"
          hrefFor={(p) => href({ unread: unreadOnly, perPage }, p)}
          perPageSelect={
            <PerPageSelect options={PER_PAGE_OPTIONS} defaultValue={DEFAULT_PER_PAGE} />
          }
        />
      )}
    </div>
  );
}
