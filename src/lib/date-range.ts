import type { Prisma } from "@/generated/prisma/client";

/** Parse a `yyyy-MM-dd` query param into a local start-of-day Date. */
export function parseDayParam(value: string | undefined | null): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Build a `createdAt` range filter from parsed day bounds. `to` is treated
 * as inclusive of its whole day (via an exclusive upper bound the next day),
 * so a same-day from/to still matches rows created any time that day.
 */
export function createdAtRange(
  from?: Date,
  to?: Date
): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  const range: Prisma.DateTimeFilter = {};
  if (from) range.gte = from;
  if (to) {
    const next = new Date(to);
    next.setDate(next.getDate() + 1);
    range.lt = next;
  }
  return range;
}
