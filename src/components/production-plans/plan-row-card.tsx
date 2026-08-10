"use client";

import { useState, useTransition, type ReactNode } from "react";
import { PencilIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updatePlanRow, type PlanActionState } from "@/lib/actions/production-plans";
import { cn } from "@/lib/utils";

export type PlanRowChange = {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedByName: string;
  changedAt: string;
};

export type PlanRowSnapshot = {
  statusInstruction: string;
  productId: string | null;
  productName: string | null;
  referenceCycleTime: string;
  remarks: string;
};

export type PlanRowCardProps = {
  rowId: string;
  machineId: string;
  machineCode: string;
  machineName: string;
  statusInstruction: string;
  productId: string | null;
  productName: string | null;
  referenceCycleTime: string;
  remarks: string;
  products: { id: string; name: string }[];
  canEdit: boolean;
  planApproved: boolean;
  snapshot: PlanRowSnapshot | null;
  changes: PlanRowChange[];
  /** Optional row rendered under the title (e.g. the setup-tickets panel). */
  ticketsPanel?: ReactNode;
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap text-sm">{value || "—"}</dd>
    </div>
  );
}

export function PlanRowCard(props: PlanRowCardProps) {
  const {
    rowId,
    machineId,
    machineCode,
    machineName,
    statusInstruction,
    productId,
    productName,
    referenceCycleTime,
    remarks,
    products,
    canEdit,
    planApproved,
    snapshot,
    changes,
    ticketsPanel,
  } = props;

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [product, setProduct] = useState(productId ?? "__none__");

  function submit(formData: FormData) {
    startTransition(async () => {
      const result: PlanActionState = await updatePlanRow({}, formData);
      if (result.success) {
        setOpen(false);
        setError(null);
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setProduct(productId ?? "__none__");
    else setError(null);
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{machineName}</h3>
        <div className="flex items-center gap-2">
          <Link
            href={`/assets/${machineId}`}
            className={cn(buttonVariants({ variant: "outline", size: "xs" }), "font-mono")}
          >
            {machineCode}
          </Link>
          {canEdit && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${machineName} row`}
              onClick={() => handleOpenChange(true)}
            >
              <PencilIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Wrap the passed-in panel: as a foreign element among static
          siblings it would otherwise trip React's array-key check. */}
      {ticketsPanel && <>{ticketsPanel}</>}

      <dl className="grid gap-4 md:grid-cols-2">
        <Field label="Status" value={statusInstruction} />
        <Field label="Item / product to produce" value={productName ?? "—"} />
        <Field label="Reference cycle time" value={referenceCycleTime} />
        <Field label="Remarks" value={remarks} />
      </dl>

      {planApproved && changes.length > 0 && snapshot && (
        <div className="space-y-3 rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Initial request (frozen at approval)
          </p>
          <dl className="grid gap-3 md:grid-cols-2">
            <Field label="Status" value={snapshot.statusInstruction} />
            <Field
              label="Item / product to produce"
              value={snapshot.productName ?? "—"}
            />
            <Field label="Reference cycle time" value={snapshot.referenceCycleTime} />
            <Field label="Remarks" value={snapshot.remarks} />
          </dl>
          <div className="space-y-1.5 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Changes</p>
            <ul className="space-y-1.5">
              {changes.map((c) => (
                <li key={c.id} className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{c.field}</span>:{" "}
                  <span className="line-through">{c.oldValue || "—"}</span> →{" "}
                  <span className="text-foreground">{c.newValue || "—"}</span>
                  <span className="ml-1">
                    · {c.changedByName}, {c.changedAt}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {planApproved && changes.length === 0 && (
        <p className="text-xs text-muted-foreground">No changes since approval.</p>
      )}

      {canEdit && (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit {machineName}</DialogTitle>
              <DialogDescription>
                {planApproved
                  ? "This plan is approved — each change is logged against the frozen initial request."
                  : "Update this machine's row."}
              </DialogDescription>
            </DialogHeader>

            {/* key: remount uncontrolled fields when the row's server data changes, instead of letting base-ui warn about defaultValue drifting on a mounted FieldControl */}
            <form
              key={`${statusInstruction}:${referenceCycleTime}:${remarks}`}
              action={submit}
              className="space-y-4"
              suppressHydrationWarning
            >
              <input type="hidden" name="rowId" value={rowId} />
              <input type="hidden" name="productId" value={product === "__none__" ? "" : product} />
              <div className="space-y-2">
                <Label htmlFor={`edit-status-${rowId}`}>Status</Label>
                <Textarea
                  id={`edit-status-${rowId}`}
                  name="statusInstruction"
                  defaultValue={statusInstruction}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`edit-product-${rowId}`}>Item / product to produce</Label>
                <Select
                  items={{
                    __none__: "None",
                    ...Object.fromEntries(products.map((p) => [p.id, p.name])),
                  }}
                  value={product}
                  onValueChange={(v) => setProduct(v ?? "__none__")}
                >
                  <SelectTrigger id={`edit-product-${rowId}`} className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`edit-cycle-${rowId}`}>Reference cycle time</Label>
                <Textarea
                  id={`edit-cycle-${rowId}`}
                  name="referenceCycleTime"
                  defaultValue={referenceCycleTime}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`edit-remarks-${rowId}`}>Remarks</Label>
                <Textarea
                  id={`edit-remarks-${rowId}`}
                  name="remarks"
                  defaultValue={remarks}
                  rows={2}
                />
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
      )}
    </div>
  );
}
