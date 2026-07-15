import type { Prisma } from "@/generated/prisma/client";

/**
 * Atomic, yearly-resetting ticket number: TKT-{year}-{counter}. Backed by
 * the TicketNumberCounter (year, counter) table via INSERT ... ON CONFLICT
 * ... RETURNING, so two concurrent creates can never collide — call this
 * only inside the same transaction that creates the Ticket row.
 */
export async function nextTicketNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getUTCFullYear();
  const rows = await tx.$queryRaw<{ counter: number }[]>`
    INSERT INTO "TicketNumberCounter" ("year", "counter")
    VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "counter" = "TicketNumberCounter"."counter" + 1
    RETURNING "counter"
  `;
  const counter = rows[0].counter;
  return `TKT-${year}-${String(counter).padStart(4, "0")}`;
}
