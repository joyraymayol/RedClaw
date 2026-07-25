"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { WrenchIcon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import {
  createMachineSetupFromPlanRow,
  type TicketActionState,
} from "@/lib/actions/tickets";
import type { TicketStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

export type SetupTicket = { id: string; ticketNumber: string; status: TicketStatus };

export function SetupTicketsPanel({
  rowId,
  tickets,
  canCreateNew,
}: {
  rowId: string;
  /** Newest first. Includes closed/cancelled tickets — they stay visible so
   * the row never looks ticket-less once one has been raised. */
  tickets: SetupTicket[];
  /** Whether the most recent ticket is stale enough (closed, or the row
   * changed since it was raised) to allow spinning off another one. */
  canCreateNew: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tickets.map((t) => (
        <Link
          key={t.id}
          href={`/tickets/${t.id}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "xs" }),
            "gap-1.5 font-mono"
          )}
          title="Open the machine-setup ticket for this row"
        >
          {t.ticketNumber}
          <TicketStatusBadge status={t.status} />
        </Link>
      ))}
      {canCreateNew && (
        <Button
          variant="outline"
          size="xs"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              // On success this redirects to the new ticket; only errors return.
              const res: TicketActionState = await createMachineSetupFromPlanRow(rowId);
              if (res?.error) setError(res.error);
            });
          }}
        >
          <WrenchIcon className="size-3.5" />
          {pending
            ? "Creating…"
            : tickets.length > 0
              ? "Create new setup ticket"
              : "Create setup ticket"}
        </Button>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
