import { Badge } from "@/components/ui/badge";
import type { MachineStatus } from "@/generated/prisma/enums";

const STATUS_BADGE: Record<
  MachineStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  OPERATIONAL: { label: "Operational", variant: "secondary" },
  DOWN: { label: "Down", variant: "destructive" },
  UNDER_MAINTENANCE: { label: "Under maintenance", variant: "default" },
};

export function MachineStatusBadge({ status }: { status: MachineStatus }) {
  const { label, variant } = STATUS_BADGE[status];
  return <Badge variant={variant}>{label}</Badge>;
}
