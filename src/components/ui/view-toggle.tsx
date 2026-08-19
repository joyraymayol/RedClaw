import Link from "next/link";
import { LayoutGridIcon, TableIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Card/Table icon button-group — plain links so it works with no client JS,
    same pattern as the filter tabs elsewhere on these pages. */
export function ViewToggle({
  view,
  cardHref,
  tableHref,
}: {
  view: "card" | "table";
  cardHref: string;
  tableHref: string;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border p-0.5">
      <Link
        href={cardHref}
        aria-label="Card view"
        aria-pressed={view === "card"}
        className={cn(
          "flex items-center justify-center rounded-sm p-1.5 transition-colors",
          view === "card"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <LayoutGridIcon className="size-4" />
      </Link>
      <Link
        href={tableHref}
        aria-label="Table view"
        aria-pressed={view === "table"}
        className={cn(
          "flex items-center justify-center rounded-sm p-1.5 transition-colors",
          view === "table"
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <TableIcon className="size-4" />
      </Link>
    </div>
  );
}
