import { Badge } from "@/components/ui/badge";
import type { TicketType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const TYPE_BADGE: Record<TicketType, { label: string; className: string }> = {
  MAINTENANCE: {
    label: "Maintenance",
    className: "border-border text-muted-foreground",
  },
  PREVENTIVE_MAINTENANCE: {
    label: "Preventive",
    className: "border-transparent bg-sky-500/15 text-sky-600 dark:text-sky-400",
  },
  MACHINE_SETUP: {
    label: "Machine setup",
    className: "border-transparent bg-violet-500/15 text-violet-600 dark:text-violet-400",
  },
};

/** Human labels for the TicketType enum, reused by filters/dropdowns. */
export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  MAINTENANCE: "Maintenance",
  PREVENTIVE_MAINTENANCE: "Preventive Maintenance",
  MACHINE_SETUP: "Machine Setup",
};

export function TicketTypeBadge({ type }: { type: TicketType }) {
  const { label, className } = TYPE_BADGE[type];
  return (
    <Badge variant="outline" className={cn(className)}>
      {label}
    </Badge>
  );
}
