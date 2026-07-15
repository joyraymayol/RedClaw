import { Badge } from "@/components/ui/badge";
import type { TicketStatus } from "@/generated/prisma/enums";

const STATUS_BADGE: Record<
  TicketStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  OPEN: { label: "Open", variant: "outline" },
  ASSIGNED: { label: "Assigned", variant: "default" },
  IN_PROGRESS: { label: "In progress", variant: "default" },
  ON_HOLD: { label: "On hold", variant: "secondary" },
  PENDING_VERIFICATION: { label: "Pending verification", variant: "secondary" },
  PENDING_SUPERVISOR_REVIEW: { label: "Pending review", variant: "secondary" },
  REOPENED: { label: "Reopened", variant: "destructive" },
  CLOSED: { label: "Closed", variant: "secondary" },
  CANCELLED: { label: "Cancelled", variant: "outline" },
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const { label, variant } = STATUS_BADGE[status];
  return <Badge variant={variant}>{label}</Badge>;
}
