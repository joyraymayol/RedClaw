import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { ApproverManager } from "@/components/production-plans/approver-manager";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { departmentLabel } from "@/lib/constants/org";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Plan approvers" };

export default async function PlanApproversPage() {
  await requireRole("ADMIN", "HEAD");

  const [approverRows, users] = await Promise.all([
    prisma.productionPlanApprover.findMany({
      orderBy: { addedAt: "asc" },
      include: {
        user: { select: { id: true, name: true, email: true, department: true } },
      },
    }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const approverIds = new Set(approverRows.map((a) => a.userId));
  const approvers = approverRows.map((a) => ({
    userId: a.userId,
    name: a.user.name,
    email: a.user.email,
    departmentLabel: departmentLabel(a.user.department),
  }));
  const candidates = users.filter((u) => !approverIds.has(u.id));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/production-plans"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
        >
          <ArrowLeftIcon className="size-4" />
          Production plans
        </Link>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Designated approvers</h1>
          <p className="text-sm text-muted-foreground">
            Any one of these users can approve a submitted plan. Approving freezes
            the plan and opens it for Maintenance.
          </p>
        </div>
      </div>

      <ApproverManager approvers={approvers} candidates={candidates} />
    </div>
  );
}
