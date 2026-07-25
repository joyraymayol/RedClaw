"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { format, parse } from "date-fns";
import { CalendarIcon, FilterIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { TICKET_PRIORITY_LABELS } from "@/components/tickets/ticket-priority-badge";
import { TICKET_STATUS_LABELS } from "@/components/tickets/ticket-status-badge";
import { TICKET_TYPE_LABELS } from "@/components/tickets/ticket-type-badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { TicketPriority, TicketStatus, TicketType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const FMT = "yyyy-MM-dd";
const ALL = "__all__";

const TYPE_OPTIONS = Object.entries(TICKET_TYPE_LABELS) as [TicketType, string][];
const PRIORITY_OPTIONS = Object.entries(TICKET_PRIORITY_LABELS) as [TicketPriority, string][];
const STATUS_OPTIONS = Object.entries(TICKET_STATUS_LABELS) as [TicketStatus, string][];

// Select.Value only resolves a friendly label once the trigger's `items`
// are known — without this it shows the raw value until the popup has
// been opened at least once.
const TYPE_ITEMS = { [ALL]: "All types", ...Object.fromEntries(TYPE_OPTIONS) };
const PRIORITY_ITEMS = { [ALL]: "All priorities", ...Object.fromEntries(PRIORITY_OPTIONS) };

function parseParam(value: string): Date | undefined {
  if (!value) return undefined;
  const d = parse(value, FMT, new Date());
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export type TicketFilterSheetState = {
  category: string;
  type: string;
  priority: string;
  statuses: TicketStatus[];
  from: string;
  to: string;
};

/**
 * Mobile "Filters" bottom sheet — holds a draft copy of category/type/
 * priority/status/raised-date, seeded from the URL each time it's opened,
 * and only touches the URL (one navigation) on Apply/Reset. Every other
 * mobile control on the tickets page applies instantly; batching these five
 * fields avoids five separate navigations while the sheet is open.
 */
export function TicketFilterSheet({
  categories,
  current,
}: {
  categories: { id: string; name: string }[];
  current: TicketFilterSheetState;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState(current.category);
  const [type, setType] = React.useState(current.type);
  const [priority, setPriority] = React.useState(current.priority);
  const [statuses, setStatuses] = React.useState<TicketStatus[]>(current.statuses);
  const [range, setRange] = React.useState<DateRange | undefined>(() => {
    const from = parseParam(current.from);
    const to = parseParam(current.to);
    return from || to ? { from, to } : undefined;
  });

  const categoryItems = React.useMemo(
    () => ({ [ALL]: "All categories", ...Object.fromEntries(categories.map((c) => [c.id, c.name])) }),
    [categories]
  );

  function handleOpenChange(next: boolean) {
    if (next) {
      setCategory(current.category);
      setType(current.type);
      setPriority(current.priority);
      setStatuses(current.statuses);
      const from = parseParam(current.from);
      const to = parseParam(current.to);
      setRange(from || to ? { from, to } : undefined);
    }
    setOpen(next);
  }

  function toggleStatus(status: TicketStatus, checked: boolean) {
    setStatuses((prev) => (checked ? [...prev, status] : prev.filter((s) => s !== status)));
  }

  function apply() {
    const params = new URLSearchParams(searchParams);
    if (category) params.set("category", category);
    else params.delete("category");
    if (type) params.set("type", type);
    else params.delete("type");
    if (priority) params.set("priority", priority);
    else params.delete("priority");
    if (statuses.length > 0) params.set("status", statuses.join(","));
    else params.delete("status");
    if (range?.from) params.set("from", format(range.from, FMT));
    else params.delete("from");
    if (range?.to) params.set("to", format(range.to, FMT));
    else params.delete("to");
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
    setOpen(false);
  }

  function resetAll() {
    const params = new URLSearchParams(searchParams);
    for (const key of ["category", "type", "priority", "status", "from", "to", "page"]) {
      params.delete(key);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
    setOpen(false);
  }

  const activeCount =
    (current.category ? 1 : 0) +
    (current.type ? 1 : 0) +
    (current.priority ? 1 : 0) +
    (current.statuses.length > 0 ? 1 : 0) +
    (current.from || current.to ? 1 : 0);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger render={<Button type="button" variant="outline" className="relative shrink-0" />}>
        <FilterIcon className="size-4" />
        Filter
        {activeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
            {activeCount}
          </span>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-xl">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-2">
          <FilterField label="Category" clearable={Boolean(category)} onClear={() => setCategory("")}>
            <Select
              items={categoryItems}
              value={category || ALL}
              onValueChange={(v) => setCategory(v === ALL ? "" : (v ?? ""))}
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

          <FilterField label="Type" clearable={Boolean(type)} onClear={() => setType("")}>
            <Select
              items={TYPE_ITEMS}
              value={type || ALL}
              onValueChange={(v) => setType(v === ALL ? "" : (v ?? ""))}
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

          <FilterField label="Priority" clearable={Boolean(priority)} onClear={() => setPriority("")}>
            <Select
              items={PRIORITY_ITEMS}
              value={priority || ALL}
              onValueChange={(v) => setPriority(v === ALL ? "" : (v ?? ""))}
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

          <FilterField
            label="Status"
            clearable={statuses.length > 0}
            onClear={() => setStatuses([])}
          >
            <ScrollArea className="max-h-48 rounded-md border">
              <div className="space-y-1 p-2">
                {STATUS_OPTIONS.map(([value, label]) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 rounded-sm px-1.5 py-1.5 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      checked={statuses.includes(value)}
                      onCheckedChange={(checked) => toggleStatus(value, checked === true)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </ScrollArea>
          </FilterField>

          <FilterField
            label="Raised date"
            clearable={Boolean(range?.from || range?.to)}
            onClear={() => setRange(undefined)}
          >
            <DateRangePicker range={range} onChange={setRange} />
          </FilterField>
        </div>

        <SheetFooter>
          <Button type="button" onClick={apply}>
            Apply filters
          </Button>
          <Button type="button" variant="ghost" className="text-primary" onClick={resetAll}>
            Reset all
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function FilterField({
  label,
  clearable,
  onClear,
  children,
}: {
  label: string;
  clearable: boolean;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {clearable && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-primary hover:underline"
          >
            Clear
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function DateRangePicker({
  range,
  onChange,
}: {
  range: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const from = range?.from;
  const to = range?.to;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn("w-full justify-start font-normal", !from && !to && "text-muted-foreground")}
          />
        }
      >
        <CalendarIcon className="size-4" />
        {from || to
          ? `${from ? format(from, "MMM d, yyyy") : "…"} – ${to ? format(to, "MMM d, yyyy") : "…"}`
          : "Select date range"}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          defaultMonth={from ?? to}
          onSelect={(next) => {
            onChange(next);
            if (next?.from && next?.to) setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
