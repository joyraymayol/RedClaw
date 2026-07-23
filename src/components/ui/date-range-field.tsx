"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const FMT = "yyyy-MM-dd";

function toDate(value?: Date | string | null): Date | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? new Date(value) : value;
}

/**
 * A FormData-driven date-range picker — the range analogue of DateField.
 * Emits two hidden inputs, `${name}From` and `${name}To` (each `yyyy-MM-dd`,
 * empty when unset), read straight from FormData and validated by
 * requiredDate()/optionalDate() + a from<=to refine.
 */
function DateRangeField({
  id,
  name,
  defaultFrom,
  defaultTo,
  placeholder = "Pick a date range",
  className,
}: {
  id?: string;
  name: string;
  defaultFrom?: Date | string | null;
  defaultTo?: Date | string | null;
  placeholder?: string;
  className?: string;
}) {
  const [range, setRange] = React.useState<DateRange | undefined>(() => {
    const from = toDate(defaultFrom);
    const to = toDate(defaultTo);
    return from || to ? { from, to } : undefined;
  });
  const [open, setOpen] = React.useState(false);

  const from = range?.from;
  const to = range?.to;

  return (
    <>
      <input type="hidden" name={`${name}From`} value={from ? format(from, FMT) : ""} />
      <input type="hidden" name={`${name}To`} value={to ? format(to, FMT) : ""} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-start font-normal",
                !from && !to && "text-muted-foreground",
                className
              )}
            />
          }
        >
          <CalendarIcon className="size-4" />
          {from || to
            ? `${from ? format(from, "PPP") : "…"} – ${to ? format(to, "PPP") : "…"}`
            : placeholder}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={range}
            defaultMonth={from ?? to}
            onSelect={(next) => {
              setRange(next);
              if (next?.from && next?.to) setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}

export { DateRangeField };
