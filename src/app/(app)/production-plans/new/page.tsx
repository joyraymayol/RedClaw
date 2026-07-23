import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  ProductionPlanForm,
  type MachineOption,
} from "@/components/production-plans/production-plan-form";
import { requireActiveUser } from "@/lib/auth";
import { canPreparePlan } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Prepare a production plan" };

export default async function NewProductionPlanPage() {
  const user = await requireActiveUser();
  if (!canPreparePlan(user)) redirect("/production-plans");

  // Production Machines are identified by the category flag, never by name.
  const machines = await prisma.asset.findMany({
    where: { status: { not: "RETIRED" }, category: { tracksProducts: true } },
    orderBy: { assetCode: "asc" },
    select: {
      id: true,
      assetCode: true,
      name: true,
      productCapabilities: {
        orderBy: { addedAt: "asc" },
        select: { product: { select: { id: true, name: true } } },
      },
    },
  });

  const machineOptions: MachineOption[] = machines.map((m) => ({
    id: m.id,
    assetCode: m.assetCode,
    name: m.name,
    products: m.productCapabilities.map((c) => c.product),
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Prepare a production plan</h1>
        <p className="text-sm text-muted-foreground">
          Fill in the header and one row per production machine, then save as a
          draft. Submit it for approval when it&apos;s ready.
        </p>
      </div>

      <ProductionPlanForm machines={machineOptions} />
    </div>
  );
}
