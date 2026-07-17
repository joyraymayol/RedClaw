import Link from "next/link";

/** Server-safe "Showing X–Y of Z" + Previous/Next bar reused by every
    paginated list page — hrefFor is a plain function computed server-side,
    so no client boundary is needed here. */
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
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {total === 0
          ? `0 ${itemLabel}s`
          : `Showing ${rangeStart}–${rangeEnd} of ${total} ${itemLabel}${total === 1 ? "" : "s"}`}
      </p>
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
  );
}
