"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { WrenchIcon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  createMachineSetupFromPlanRow,
  type TicketActionState,
} from "@/lib/actions/tickets";
import { cn } from "@/lib/utils";

export function CreateSetupTicketButton({
  rowId,
  existingTicket,
}: {
  rowId: string;
  existingTicket: { id: string; ticketNumber: string } | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (existingTicket) {
    return (
      <Link
        href={`/tickets/${existingTicket.id}`}
        className={cn(buttonVariants({ variant: "outline", size: "xs" }), "font-mono")}
        title="Open the machine-setup ticket for this row"
      >
        {existingTicket.ticketNumber}
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
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
        {pending ? "Creating…" : "Create setup ticket"}
      </Button>
      {error && <span className="text-right text-xs text-destructive">{error}</span>}
    </div>
  );
}
