"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcwIcon } from "lucide-react";

import { TICKET_PRIORITY_LABELS } from "@/components/tickets/ticket-priority-badge";
import { TICKET_STATUS_LABELS } from "@/components/tickets/ticket-status-badge";
import { TICKET_TYPE_LABELS } from "@/components/tickets/ticket-type-badge";
import { Button } from "@/components/ui/button";
import { DebouncedSearchInput } from "@/components/ui/debounced-search-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TicketPriority, TicketStatus, TicketType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const ALL = "__all__";

const TYPE_OPTIONS = Object.entries(TICKET_TYPE_LABELS) as [TicketType, string][];
const PRIORITY_OPTIONS = Object.entries(TICKET_PRIORITY_LABELS) as [TicketPriority, string][];
const STATUS_OPTIONS = Object.entries(TICKET_STATUS_LABELS) as [TicketStatus, string][];

// Select.Value only resolves a friendly label once the trigger's `items`
// are known — without this it shows the raw value until the popup has
// been opened at least once.
const TYPE_ITEMS = { [ALL]: "All types", ...Object.fromEntries(TYPE_OPTIONS) };
const PRIORITY_ITEMS = { [ALL]: "All priorities", ...Object.fromEntries(PRIORITY_OPTIONS) };
const STATUS_ITEMS = { [ALL]: "All statuses", ...Object.fromEntries(STATUS_OPTIONS) };

const FILTER_KEYS = ["category", "asset", "type", "priority", "status", "technician", "q"];

/**
 * Desktop/laptop filter panel below the status tabs — a bordered grid of
 * instant-apply selects (Category/Asset/Type/Technician/Priority/Status)
 * plus search and a clear-all, mirroring the mobile filter sheet's fields
 * one-for-one except each control here navigates immediately instead of
 * batching behind an Apply button. A single grid-cols-3 template (rather
 * than a wider `lg:` variant with an `auto`-sized last column) keeps every
 * field — including search — the same width at every column it lands in.
 */
export function TicketFilterBar({
  categories,
  assets,
  technicians,
  current,
}: {
  categories: { id: string; name: string }[];
  assets: { id: string; assetCode: string; name: string }[];
  technicians: { id: string; name: string }[];
  current: {
    category: string;
    asset: string;
    type: string;
    priority: string;
    status: string;
    technician: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const categoryItems = React.useMemo(
    () => ({ [ALL]: "All categories", ...Object.fromEntries(categories.map((c) => [c.id, c.name])) }),
    [categories]
  );
  const assetItems = React.useMemo(
    () => ({
      [ALL]: "All assets",
      ...Object.fromEntries(assets.map((a) => [a.id, `${a.assetCode} — ${a.name}`])),
    }),
    [assets]
  );
  const technicianItems = React.useMemo(
    () => ({ [ALL]: "All technicians", ...Object.fromEntries(technicians.map((t) => [t.id, t.name])) }),
    [technicians]
  );

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const hasActiveFilters = FILTER_KEYS.some((key) => searchParams.get(key));

  function clearFilters() {
    const params = new URLSearchParams(searchParams);
    for (const key of FILTER_KEYS) params.delete(key);
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="rounded-lg border p-4">
      {/* Every field gets an explicit sm:col-start instead of relying on
          grid auto-flow + a hidden spacer — the last row (Search/Clear
          filters) needs one gap left empty (col 2), and pinning every item's
          column directly is what actually guarantees Clear filters lands in
          the last column instead of drifting next to Search. */}
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-3">
        <FilterField label="Category" colStart={1}>
          <Select
            items={categoryItems}
            value={current.category || ALL}
            onValueChange={(v) => setParam("category", v === ALL ? "" : (v ?? ""))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Asset" colStart={2}>
          <Select
            items={assetItems}
            value={current.asset || ALL}
            onValueChange={(v) => setParam("asset", v === ALL ? "" : (v ?? ""))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All assets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All assets</SelectItem>
              {assets.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.assetCode} — {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Type" colStart={3}>
          <Select
            items={TYPE_ITEMS}
            value={current.type || ALL}
            onValueChange={(v) => setParam("type", v === ALL ? "" : (v ?? ""))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All types</SelectItem>
              {TYPE_OPTIONS.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Technician" colStart={1}>
          <Select
            items={technicianItems}
            value={current.technician || ALL}
            onValueChange={(v) => setParam("technician", v === ALL ? "" : (v ?? ""))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All technicians" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All technicians</SelectItem>
              {technicians.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Priority" colStart={2}>
          <Select
            items={PRIORITY_ITEMS}
            value={current.priority || ALL}
            onValueChange={(v) => setParam("priority", v === ALL ? "" : (v ?? ""))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All priorities</SelectItem>
              {PRIORITY_OPTIONS.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Status" colStart={3}>
          <Select
            items={STATUS_ITEMS}
            value={current.status || ALL}
            onValueChange={(v) => setParam("status", v === ALL ? "" : (v ?? ""))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {STATUS_OPTIONS.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Search" hideLabel colStart={1} extraGap>
          <DebouncedSearchInput
            placeholder="Search ticket #, title, asset…"
            ariaLabel="Search tickets"
            resetParams={["page"]}
            className="w-full sm:max-w-none"
          />
        </FilterField>

        <Button
          type="button"
          variant="outline"
          onClick={clearFilters}
          disabled={!hasActiveFilters}
          className="w-full sm:col-start-3 sm:mt-2.5"
        >
          <RotateCcwIcon className="size-4" />
          Clear filters
        </Button>
      </div>
    </div>
  );
}

function FilterField({
  label,
  hideLabel,
  colStart,
  extraGap,
  children,
}: {
  label: string;
  hideLabel?: boolean;
  colStart: 1 | 2 | 3;
  /** Extra breathing room above the last row, on top of the grid's own gap. */
  extraGap?: boolean;
  children: React.ReactNode;
}) {
  const COL_START_CLASS = { 1: "sm:col-start-1", 2: "sm:col-start-2", 3: "sm:col-start-3" } as const;
  return (
    <div className={cn("space-y-1.5", COL_START_CLASS[colStart], extraGap && "sm:mt-2.5")}>
      <Label className={hideLabel ? "sr-only" : undefined}>{label}</Label>
      {children}
    </div>
  );
}
