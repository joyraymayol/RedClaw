import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Server-safe "Showing X–Y of Z" + Previous/Next bar reused by every
    paginated list page — hrefFor is a plain function computed server-side,
    so no client boundary is needed here. Renders a compact single-row bar
    on desktop and a card-style layout on mobile. */
export function PaginationBar({
  total,
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  itemLabel,
  hrefFor,
  perPageSelect,
}: {
  total: number;
  page: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  itemLabel: string;
  hrefFor: (page: number) => string;
  perPageSelect?: React.ReactNode;
}) {
  const rangeLabel =
    total === 0
      ? `0 ${itemLabel}s`
      : `Showing ${rangeStart}–${rangeEnd} of ${total} ${itemLabel}${total === 1 ? "" : "s"}`;

  return (
    <div>
      <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
        <p className="text-sm text-muted-foreground">{rangeLabel}</p>
        <div className="flex flex-wrap items-center gap-4">
          {perPageSelect}
          <div className="flex items-center gap-1 text-sm">
            {page > 1 ? (
              <Link
                href={hrefFor(page - 1)}
                className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                Previous
              </Link>
            ) : (
              <span className="px-2.5 py-1.5 text-muted-foreground/40">Previous</span>
            )}
            <span className="px-1 text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={hrefFor(page + 1)}
                className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                Next
              </Link>
            ) : (
              <span className="px-2.5 py-1.5 text-muted-foreground/40">Next</span>
            )}
          </div>
        </div>
      </div>

      <Card size="sm" className="gap-3 px-3 py-3 md:hidden">
        <div className="flex justify-center">{perPageSelect}</div>
        <div className="text-center">
          <p className="text-sm font-semibold text-foreground">
            Page {page} of {totalPages}
          </p>
          <p className="text-xs text-muted-foreground">{rangeLabel}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {page > 1 ? (
            <Button
              variant="outline"
              size="sm"
              render={<Link href={hrefFor(page - 1)} aria-label="Previous page" />}
              nativeButton={false}
              className="w-full"
            >
              <ChevronLeftIcon className="size-4" />
              Prev
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              className="w-full"
            >
              <ChevronLeftIcon className="size-4" />
              Prev
            </Button>
          )}
          {page < totalPages ? (
            <Button
              size="sm"
              render={<Link href={hrefFor(page + 1)} aria-label="Next page" />}
              nativeButton={false}
              className="w-full"
            >
              Next
              <ChevronRightIcon className="size-4" />
            </Button>
          ) : (
            <Button type="button" size="sm" disabled className="w-full">
              Next
              <ChevronRightIcon className="size-4" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
