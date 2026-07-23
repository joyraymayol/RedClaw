"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { DateRangeField } from "@/components/ui/date-range-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createProductionPlan,
  type PlanActionState,
} from "@/lib/actions/production-plans";

export type MachineOption = {
  id: string;
  assetCode: string;
  name: string;
  products: { id: string; name: string }[];
};

type RowState = {
  assetId: string;
  statusInstruction: string;
  productId: string;
  referenceCycleTime: string;
  remarks: string;
};

const initialState: PlanActionState = {};

export function ProductionPlanForm({ machines }: { machines: MachineOption[] }) {
  const [state, formAction, pending] = useActionState<PlanActionState, FormData>(
    createProductionPlan,
    initialState
  );
  const [rows, setRows] = useState<RowState[]>(() =>
    machines.map((m) => ({
      assetId: m.id,
      statusInstruction: "",
      productId: "",
      referenceCycleTime: "",
      remarks: "",
    }))
  );

  function updateRow(assetId: string, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r) => (r.assetId === assetId ? { ...r, ...patch } : r)));
  }

  const rowByAsset = new Map(rows.map((r) => [r.assetId, r]));

  return (
    <>
      {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
      <form action={formAction} className="space-y-6" suppressHydrationWarning>
        <input type="hidden" name="rows" value={JSON.stringify(rows)} />

        <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="formNumber">Form number</Label>
            <Input id="formNumber" name="formNumber" placeholder="PP-2026-W30" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="schedule">Production schedule</Label>
            <DateRangeField id="schedule" name="schedule" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="effectiveDate">Effective date</Label>
            <DateField id="effectiveDate" name="effectiveDate" />
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            Production machines ({machines.length})
          </h2>

          {machines.length === 0 && (
            <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
              No production machines found. Add a machine under a product-tracking
              category first.
            </p>
          )}

          {machines.map((m) => {
            const row = rowByAsset.get(m.id)!;
            const productItems = {
              __none__: "None",
              ...Object.fromEntries(m.products.map((p) => [p.id, p.name])),
            };
            return (
              <div key={m.id} className="space-y-4 rounded-lg border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium">{m.name}</h3>
                  <span className="font-mono text-xs text-muted-foreground">{m.assetCode}</span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`status-${m.id}`}>Status</Label>
                    <Textarea
                      id={`status-${m.id}`}
                      value={row.statusInstruction}
                      onChange={(e) => updateRow(m.id, { statusInstruction: e.target.value })}
                      placeholder="Instruction for this machine"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`product-${m.id}`}>Item / product to produce</Label>
                    <Select
                      items={productItems}
                      value={row.productId || "__none__"}
                      onValueChange={(v) =>
                        updateRow(m.id, { productId: v === "__none__" ? "" : (v ?? "") })
                      }
                    >
                      <SelectTrigger id={`product-${m.id}`} className="w-full">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {m.products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {m.products.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        This machine has no product capabilities set.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`cycle-${m.id}`}>Reference cycle time</Label>
                    <Textarea
                      id={`cycle-${m.id}`}
                      value={row.referenceCycleTime}
                      onChange={(e) => updateRow(m.id, { referenceCycleTime: e.target.value })}
                      placeholder="e.g. 22 s / cycle, 48 cavities"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`remarks-${m.id}`}>Remarks</Label>
                    <Textarea
                      id={`remarks-${m.id}`}
                      value={row.remarks}
                      onChange={(e) => updateRow(m.id, { remarks: e.target.value })}
                      placeholder="Anything worth noting"
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Button type="submit" disabled={pending || machines.length === 0}>
          {pending ? "Saving…" : "Save as draft"}
        </Button>
      </form>
      {state.error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive"
        >
          {state.error}
        </p>
      )}
    </>
  );
}
