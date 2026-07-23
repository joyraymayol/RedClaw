"use client";

import * as React from "react";
import { format, parse } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const FMT = "yyyy-MM-dd";

function parseParam(value: string | null): Date | undefined {
  if (!value) return undefined;
  const d = parse(value, FMT, new Date());
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * A URL-driven raised-date range filter. Writes `fromParam`/`toParam` as
 * `yyyy-MM-dd` into the query string (models DebouncedSearchInput's
 * router.replace approach) and drops `resetParams` (a scoped page param) on
 * change. Built on the range-capable base Calendar.
 */
export function DateRangeFilter({
  fromParam = "from",
  toParam = "to",
  resetParams = [],
  label = "Raised date",
  className,
}: {
  fromParam?: string;
  toParam?: string;
  resetParams?: string[];
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const from = parseParam(searchParams.get(fromParam));
  const to = parseParam(searchParams.get(toParam));
  const [open, setOpen] = React.useState(false);

  function commit(range: DateRange | undefined) {
    const params = new URLSearchParams(searchParams);
    if (range?.from) params.set(fromParam, format(range.from, FMT));
    else params.delete(fromParam);
    if (range?.to) params.set(toParam, format(range.to, FMT));
    else params.delete(toParam);
    for (const key of resetParams) params.delete(key);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  const hasRange = Boolean(from || to);
  const triggerLabel = hasRange
    ? `${from ? format(from, "MMM d, yyyy") : "…"} – ${to ? format(to, "MMM d, yyyy") : "…"}`
    : label;

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className={cn("justify-start font-normal", !hasRange && "text-muted-foreground")}
            />
          }
        >
          <CalendarIcon className="size-4" />
          {triggerLabel}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={from || to ? { from, to } : undefined}
            defaultMonth={from ?? to}
            onSelect={(range) => {
              commit(range);
              if (range?.from && range?.to) setOpen(false);
            }}
          />
          {hasRange && (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-center"
                onClick={() => {
                  commit(undefined);
                  setOpen(false);
                }}
              >
                <XIcon className="size-4" />
                Clear
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
