import Link from "next/link";
import { MapPinIcon } from "lucide-react";

import { TicketPriorityDot } from "@/components/tickets/ticket-priority-badge";
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import { TicketTypeBadge } from "@/components/tickets/ticket-type-badge";
import type { TicketPriority, TicketStatus, TicketType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

// Only statuses that mean "this ticket needs eyes on it right now" get a
// left accent bar — Open/Assigned/Closed/Cancelled stay neutral so the
// stripe reads as a signal, not decoration.
const ACCENT_COLOR: Partial<Record<TicketStatus, string>> = {
  IN_PROGRESS: "bg-destructive",
  ON_HOLD: "bg-amber-500",
  REOPENED: "bg-amber-500",
  PENDING_VERIFICATION: "bg-amber-500",
  PENDING_SUPERVISOR_REVIEW: "bg-amber-500",
  PENDING_MAINTENANCE_APPROVAL: "bg-amber-500",
  PENDING_QA_APPROVAL: "bg-amber-500",
};

export function TicketListCard({
  ticket,
}: {
  ticket: {
    id: string;
    ticketNumber: string;
    title: string;
    type: TicketType;
    priority: TicketPriority;
    status: TicketStatus;
    assets: { asset: { name: string } }[];
  };
}) {
  const accent = ACCENT_COLOR[ticket.status];
  const assetLabel =
    ticket.assets.length === 0
      ? null
      : ticket.assets.length === 1
        ? ticket.assets[0].asset.name
        : `${ticket.assets[0].asset.name} +${ticket.assets.length - 1}`;

  return (
    <Link
      href={`/tickets/${ticket.id}`}
      className="relative flex overflow-hidden rounded-lg border bg-card pl-4 shadow-xs transition-colors active:bg-muted/40"
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", accent)} />
      <div className="min-w-0 flex-1 space-y-1.5 py-3 pr-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-muted-foreground">{ticket.ticketNumber}</span>
          <TicketPriorityDot priority={ticket.priority} />
        </div>
        <p className="truncate font-medium">{ticket.title}</p>
        {assetLabel && (
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1 truncate text-sm text-muted-foreground">
              <MapPinIcon className="size-3.5 shrink-0" />
              <span className="truncate">{assetLabel}</span>
            </span>
            <TicketStatusBadge status={ticket.status} />
          </div>
        )}
        {!assetLabel && (
          <div className="flex justify-end">
            <TicketStatusBadge status={ticket.status} />
          </div>
        )}
        {ticket.type !== "MAINTENANCE" && (
          <div>
            <TicketTypeBadge type={ticket.type} />
          </div>
        )}
      </div>
    </Link>
  );
}
