import { Badge } from "@/components/ui/badge";
import type { TicketPriority } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const PRIORITY_BADGE: Record<TicketPriority, { label: string; className: string }> = {
  LOW: { label: "Low", className: "border-border text-muted-foreground" },
  MEDIUM: { label: "Medium", className: "border-border text-foreground" },
  HIGH: {
    label: "High",
    className:
      "border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  CRITICAL: {
    label: "Critical",
    className:
      "border-transparent bg-destructive/15 text-destructive",
  },
};

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  const { label, className } = PRIORITY_BADGE[priority];
  return (
    <Badge variant="outline" className={cn(className)}>
      {label}
    </Badge>
  );
}

/** Human labels for the TicketPriority enum, reused by filters/dropdowns. */
export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = Object.fromEntries(
  Object.entries(PRIORITY_BADGE).map(([priority, { label }]) => [priority, label])
) as Record<TicketPriority, string>;

const PRIORITY_DOT_COLOR: Record<TicketPriority, string> = {
  LOW: "bg-muted-foreground/50",
  MEDIUM: "bg-foreground/60",
  HIGH: "bg-amber-500",
  CRITICAL: "bg-destructive",
};

/** Compact dot + label used in space-constrained layouts (mobile ticket cards). */
export function TicketPriorityDot({ priority }: { priority: TicketPriority }) {
  const { label } = PRIORITY_BADGE[priority];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
      <span
        aria-hidden
        className={cn("size-2 shrink-0 rounded-full", PRIORITY_DOT_COLOR[priority])}
      />
      {label}
    </span>
  );
}
