"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortDir = "asc" | "desc";

// Mirrors the `sort` keys SORT_COLUMNS understands in page.tsx — this just
// picks a sensible default direction per field for the mobile dropdown;
// desktop still exposes per-column asc/desc via SortableHead.
const SORT_OPTIONS: { value: string; dir: SortDir; label: string }[] = [
  { value: "created", dir: "desc", label: "Raised date" },
  { value: "priority", dir: "desc", label: "Priority" },
  { value: "ticketNumber", dir: "desc", label: "Ticket #" },
  { value: "status", dir: "asc", label: "Status" },
];

const DEFAULT_SORT = "created";
const DEFAULT_DIR: SortDir = "desc";

// Select.Value only resolves a friendly label once the trigger's `items`
// are known — without this it shows the raw `sort` param until the popup
// has been opened at least once.
const SELECT_ITEMS = Object.fromEntries(SORT_OPTIONS.map((o) => [o.value, o.label]));

export function TicketSortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("sort") ?? DEFAULT_SORT;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="whitespace-nowrap">Sort:</span>
      <Select
        items={SELECT_ITEMS}
        value={current}
        onValueChange={(value) => {
          const option = SORT_OPTIONS.find((o) => o.value === value);
          if (!option) return;
          const params = new URLSearchParams(searchParams);
          params.delete("page");
          if (option.value === DEFAULT_SORT) params.delete("sort");
          else params.set("sort", option.value);
          if (option.dir === DEFAULT_DIR) params.delete("dir");
          else params.set("dir", option.dir);
          const query = params.toString();
          router.replace(query ? `${pathname}?${query}` : pathname);
        }}
      >
        <SelectTrigger size="sm" aria-label="Sort tickets">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
