"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  approvePlan,
  deletePlan,
  submitPlan,
  type PlanActionState,
} from "@/lib/actions/production-plans";
import type { ProductionPlanStatus } from "@/generated/prisma/enums";

export function PlanActionsBar({
  planId,
  status,
  canEdit,
  canApprove,
}: {
  planId: string;
  status: ProductionPlanStatus;
  canEdit: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function run(fn: () => Promise<PlanActionState>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  const showSubmit = canEdit && status === "DRAFT";
  const showDelete = canEdit && status === "DRAFT";
  if (!showSubmit && !showDelete && !canApprove) return null;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {showSubmit && (
          <Button onClick={() => run(() => submitPlan(planId))} disabled={pending}>
            Submit for approval
          </Button>
        )}
        {canApprove && (
          <Button onClick={() => run(() => approvePlan(planId))} disabled={pending}>
            Approve plan
          </Button>
        )}
        {showDelete &&
          (confirmingDelete ? (
            <>
              <Button
                variant="destructive"
                onClick={() => run(() => deletePlan(planId))}
                disabled={pending}
              >
                Confirm delete
              </Button>
              <Button
                variant="outline"
                onClick={() => setConfirmingDelete(false)}
                disabled={pending}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              onClick={() => setConfirmingDelete(true)}
              disabled={pending}
            >
              Delete draft
            </Button>
          ))}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
