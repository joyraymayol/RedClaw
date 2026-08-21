import Link from "next/link";
import { CalendarIcon, UserIcon } from "lucide-react";

import { ProductionPlanStatusBadge } from "@/components/production-plans/production-plan-status-badge";
import { formatDate } from "@/lib/format";
import type { ProductionPlanStatus } from "@/generated/prisma/enums";

export function ProductionPlanListCard({
  plan,
}: {
  plan: {
    id: string;
    formNumber: string;
    scheduleFrom: Date;
    scheduleTo: Date;
    effectiveDate: Date;
    status: ProductionPlanStatus;
    preparedBy: { name: string };
    _count: { rows: number };
  };
}) {
  return (
    <Link
      href={`/production-plans/${plan.id}`}
      className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 shadow-xs transition-colors active:bg-muted/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-medium">{plan.formNumber}</span>
        <ProductionPlanStatusBadge status={plan.status} />
      </div>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <CalendarIcon className="size-3.5 shrink-0" />
        <span className="truncate">
          {formatDate(plan.scheduleFrom)} – {formatDate(plan.scheduleTo)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">Effective {formatDate(plan.effectiveDate)}</p>
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1 truncate">
          <UserIcon className="size-3.5 shrink-0" />
          <span className="truncate">{plan.preparedBy.name}</span>
        </span>
        <span className="shrink-0 tabular-nums">
          {plan._count.rows} machine{plan._count.rows === 1 ? "" : "s"}
        </span>
      </div>
    </Link>
  );
}
