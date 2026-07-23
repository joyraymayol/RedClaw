import { Badge } from "@/components/ui/badge";
import type { ProductionPlanStatus } from "@/generated/prisma/enums";

const STATUS_BADGE: Record<
  ProductionPlanStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  DRAFT: { label: "Draft", variant: "outline" },
  PENDING_APPROVAL: { label: "Pending approval", variant: "secondary" },
  APPROVED: { label: "Approved", variant: "default" },
};

export const PRODUCTION_PLAN_STATUS_LABELS: Record<ProductionPlanStatus, string> =
  Object.fromEntries(
    Object.entries(STATUS_BADGE).map(([k, v]) => [k, v.label])
  ) as Record<ProductionPlanStatus, string>;

export function ProductionPlanStatusBadge({ status }: { status: ProductionPlanStatus }) {
  const { label, variant } = STATUS_BADGE[status];
  return <Badge variant={variant}>{label}</Badge>;
}
