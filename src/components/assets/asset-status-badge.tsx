import { Badge } from "@/components/ui/badge";
import type { AssetStatus } from "@/generated/prisma/enums";

const STATUS_BADGE: Record<
  AssetStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  OPERATIONAL: { label: "Operational", variant: "secondary" },
  DOWN: { label: "Down", variant: "destructive" },
  UNDER_MAINTENANCE: { label: "Under maintenance", variant: "default" },
  RETIRED: { label: "Retired", variant: "outline" },
};

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const { label, variant } = STATUS_BADGE[status];
  return <Badge variant={variant}>{label}</Badge>;
}
