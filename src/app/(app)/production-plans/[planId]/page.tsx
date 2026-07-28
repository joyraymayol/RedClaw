import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PlanActionsBar } from "@/components/production-plans/plan-actions-bar";
import { PlanHeaderDialog } from "@/components/production-plans/plan-header-dialog";
import {
  PlanRowCard,
  type PlanRowSnapshot,
} from "@/components/production-plans/plan-row-card";
import { ProductionPlanStatusBadge } from "@/components/production-plans/production-plan-status-badge";
import { SetupTicketsPanel } from "@/components/production-plans/setup-tickets-panel";
import type { Prisma } from "@/generated/prisma/client";
import { requireActiveUser } from "@/lib/auth";
import { canPreparePlan, isMaintenanceHigher } from "@/lib/authz";
import { formatDate, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { canCreateNewSetupTicket } from "@/lib/production-plan-tickets";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ planId: string }>;
}): Promise<Metadata> {
  const { planId } = await params;
  const plan = await prisma.productionPlan.findUnique({
    where: { id: planId },
    select: { formNumber: true },
  });
  return { title: plan ? `Plan ${plan.formNumber}` : "Production plan" };
}

/** Round-trips a stored (UTC-midnight) plan date back to `yyyy-MM-dd`. */
function toDayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function coerceSnapshot(v: Prisma.JsonValue | null): PlanRowSnapshot | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  return {
    statusInstruction: typeof o.statusInstruction === "string" ? o.statusInstruction : "",
    productId: typeof o.productId === "string" ? o.productId : null,
    productName: typeof o.productName === "string" ? o.productName : null,
    referenceCycleTime: typeof o.referenceCycleTime === "string" ? o.referenceCycleTime : "",
    remarks: typeof o.remarks === "string" ? o.remarks : "",
  };
}

export default async function ProductionPlanDetailPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const user = await requireActiveUser();
  const { planId } = await params;

  const plan = await prisma.productionPlan.findUnique({
    where: { id: planId },
    include: {
      preparedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      rows: {
        orderBy: { sortOrder: "asc" },
        include: {
          asset: {
            select: {
              assetCode: true,
              name: true,
              productCapabilities: {
                orderBy: { addedAt: "asc" },
                select: { product: { select: { id: true, name: true } } },
              },
            },
          },
          product: { select: { name: true } },
          changes: {
            orderBy: { changedAt: "desc" },
            include: { changedBy: { select: { name: true } } },
          },
          // All setup tickets ever raised off this row, newest first — closed
          // ones stay visible so the row never looks ticket-less once one
          // has been raised (see canCreateNewSetupTicket for why a new one
          // may still be offered on top of an existing, non-stale ticket).
          tickets: {
            orderBy: { createdAt: "desc" },
            select: { id: true, ticketNumber: true, status: true, createdAt: true },
          },
        },
      },
    },
  });
  if (!plan) notFound();

  const canEdit = canPreparePlan(user);
  const canCreateSetup = isMaintenanceHigher(user) && plan.status === "APPROVED";
  const isApprover = !!(await prisma.productionPlanApprover.findUnique({
    where: { userId: user.id },
    select: { userId: true },
  }));
  const canApprove = isApprover && plan.status === "PENDING_APPROVAL";
  const approved = plan.status === "APPROVED";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-xs text-muted-foreground">{plan.formNumber}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Production plan</h1>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
            <ProductionPlanStatusBadge status={plan.status} />
            <span>Prepared by {plan.preparedBy.name}</span>
          </div>
        </div>
        <PlanActionsBar
          planId={plan.id}
          status={plan.status}
          canEdit={canEdit}
          canApprove={canApprove}
        />
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Details</h2>
          {canEdit && !approved && (
            <PlanHeaderDialog
              planId={plan.id}
              formNumber={plan.formNumber}
              scheduleFrom={toDayString(plan.scheduleFrom)}
              scheduleTo={toDayString(plan.scheduleTo)}
              effectiveDate={toDayString(plan.effectiveDate)}
            />
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <dt className="text-muted-foreground">Form number</dt>
          <dd className="font-mono">{plan.formNumber}</dd>
          <dt className="text-muted-foreground">Effective date</dt>
          <dd>{formatDate(plan.effectiveDate)}</dd>
          <dt className="text-muted-foreground">Schedule</dt>
          <dd>
            {formatDate(plan.scheduleFrom)} – {formatDate(plan.scheduleTo)}
          </dd>
          <dt className="text-muted-foreground">Approved</dt>
          <dd>
            {plan.approvedBy && plan.approvedAt
              ? `${plan.approvedBy.name}, ${formatDateTime(plan.approvedAt)}`
              : "—"}
          </dd>
        </dl>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          Machine rows ({plan.rows.length})
        </h2>
        {plan.rows.length === 0 && (
          <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
            This plan has no machine rows.
          </p>
        )}
        {plan.rows.map((row) => (
          <PlanRowCard
            key={row.id}
            rowId={row.id}
            machineCode={row.asset.assetCode}
            machineName={row.asset.name}
            statusInstruction={row.statusInstruction}
            productId={row.productId}
            productName={row.product?.name ?? null}
            referenceCycleTime={row.referenceCycleTime}
            remarks={row.remarks}
            products={row.asset.productCapabilities.map((c) => c.product)}
            canEdit={canEdit}
            planApproved={approved}
            snapshot={coerceSnapshot(row.approvedSnapshot)}
            changes={row.changes.map((c) => ({
              id: c.id,
              field: c.field,
              oldValue: c.oldValue,
              newValue: c.newValue,
              changedByName: c.changedBy.name,
              changedAt: formatDateTime(c.changedAt),
            }))}
            ticketsPanel={
              <SetupTicketsPanel
                rowId={row.id}
                tickets={row.tickets}
                canCreateNew={
                  canCreateSetup &&
                  canCreateNewSetupTicket(
                    row.tickets[0] ?? null,
                    row.changes[0]?.changedAt ?? null
                  )
                }
              />
            }
          />
        ))}
      </div>
    </div>
  );
}
