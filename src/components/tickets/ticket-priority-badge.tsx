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
