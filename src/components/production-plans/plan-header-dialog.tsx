"use client";

import { useState, useTransition } from "react";
import { PencilIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { DateRangeField } from "@/components/ui/date-range-field";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePlanHeader, type PlanActionState } from "@/lib/actions/production-plans";

export function PlanHeaderDialog({
  planId,
  formNumber,
  scheduleFrom,
  scheduleTo,
  effectiveDate,
}: {
  planId: string;
  formNumber: string;
  scheduleFrom: string;
  scheduleTo: string;
  effectiveDate: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result: PlanActionState = await updatePlanHeader({}, formData);
      if (result.success) {
        setOpen(false);
        setError(null);
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Edit plan header"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <PencilIcon className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit plan header</DialogTitle>
            <DialogDescription>
              Update the form number, schedule, and effective date.
            </DialogDescription>
          </DialogHeader>

          <form action={submit} className="space-y-4" suppressHydrationWarning>
            <input type="hidden" name="planId" value={planId} />
            <div className="space-y-2">
              <Label htmlFor="formNumber">Form number</Label>
              <Input id="formNumber" name="formNumber" defaultValue={formNumber} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule">Production schedule</Label>
              <DateRangeField
                id="schedule"
                name="schedule"
                defaultFrom={scheduleFrom}
                defaultTo={scheduleTo}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="effectiveDate">Effective date</Label>
              <DateField id="effectiveDate" name="effectiveDate" defaultValue={effectiveDate} />
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive"
            >
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
