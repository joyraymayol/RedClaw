"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { TicketActionState } from "@/lib/actions/tickets";

const initialState: TicketActionState = {};

/** A single-field (ticketId only) action rendered as one submit button — no confirmation dialog needed. */
export function SimpleActionButton({
  action,
  ticketId,
  label,
  pendingLabel,
  icon,
  variant = "default",
}: {
  action: (prevState: TicketActionState, formData: FormData) => Promise<TicketActionState>;
  ticketId: string;
  label: string;
  pendingLabel?: string;
  icon?: React.ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
}) {
  const [state, formAction, pending] = useActionState<TicketActionState, FormData>(
    action,
    initialState
  );

  return (
    <div>
      {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
      <form action={formAction} suppressHydrationWarning>
        <input type="hidden" name="ticketId" value={ticketId} />
        <Button type="submit" variant={variant} disabled={pending}>
          {icon}
          {pending ? (pendingLabel ?? "Working…") : label}
        </Button>
      </form>
      {state.error && (
        <p role="alert" className="mt-1.5 text-xs text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}
