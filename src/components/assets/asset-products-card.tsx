"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  setCurrentProduct,
  updateProductCapabilities,
  type AssetActionState,
} from "@/lib/actions/assets";

type ProductOption = { id: string; name: string };
type ChangeLogEntry = {
  id: string;
  productName: string | null;
  changedByName: string;
  changedAt: Date;
};

function CapabilitiesDialog({
  assetId,
  allProducts,
  currentCapabilityIds,
}: {
  assetId: string;
  allProducts: ProductOption[];
  currentCapabilityIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set(currentCapabilityIds));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setSelected(new Set(currentCapabilityIds));
    else setError(null);
  }

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      const result: AssetActionState = await updateProductCapabilities({}, formData);
      if (result.success) {
        setOpen(false);
        setError(null);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => handleOpenChange(true)}>
        Edit capabilities
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Product capabilities</DialogTitle>
            <DialogDescription>
              Which products this asset can be set to run. Removing the
              current product also clears it.
            </DialogDescription>
          </DialogHeader>

          {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
          <form action={submit} className="space-y-4" suppressHydrationWarning>
            <input type="hidden" name="assetId" value={assetId} />
            {[...selected].map((id) => (
              <input key={id} type="hidden" name="productIds" value={id} />
            ))}
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
              {allProducts.length === 0 && (
                <p className="p-2 text-sm text-muted-foreground">
                  No products yet — add some in Asset settings.
                </p>
              )}
              {allProducts.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={selected.has(p.id)}
                    onCheckedChange={(checked) => toggle(p.id, checked === true)}
                  />
                  {p.name}
                </label>
              ))}
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save capabilities"}
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

function SetCurrentProductForm({
  assetId,
  capabilities,
  currentProductId,
  disabled,
}: {
  assetId: string;
  capabilities: ProductOption[];
  currentProductId: string | null;
  disabled: boolean;
}) {
  const [productId, setProductId] = useState(currentProductId ?? "__none__");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const items = {
    __none__: "None",
    ...Object.fromEntries(capabilities.map((p) => [p.id, p.name])),
  };

  function submit(formData: FormData) {
    startTransition(async () => {
      const result: AssetActionState = await setCurrentProduct({}, formData);
      setError(result.success ? null : (result.error ?? "Something went wrong."));
    });
  }

  return (
    <div className="space-y-2">
      {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
      <form action={submit} className="flex items-end gap-2" suppressHydrationWarning>
        <input type="hidden" name="assetId" value={assetId} />
        <div className="flex-1 space-y-2">
          <Label htmlFor="productId">Current product</Label>
          <Select
            name="productId"
            items={items}
            value={productId}
            onValueChange={(v) => setProductId(v ?? "__none__")}
            disabled={disabled}
          >
            <SelectTrigger id="productId" className="w-full">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {capabilities.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={pending || disabled}>
          {pending ? "Setting…" : "Set"}
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function AssetProductsCard({
  assetId,
  retired,
  canManage,
  allProducts,
  capabilities,
  currentProductId,
  currentProductName,
  changeLogs,
}: {
  assetId: string;
  retired: boolean;
  canManage: boolean;
  allProducts: ProductOption[];
  capabilities: ProductOption[];
  currentProductId: string | null;
  currentProductName: string | null;
  changeLogs: ChangeLogEntry[];
}) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Products</h2>
        {canManage && (
          <CapabilitiesDialog
            assetId={assetId}
            allProducts={allProducts}
            currentCapabilityIds={capabilities.map((c) => c.id)}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {capabilities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No product capabilities set.</p>
        ) : (
          capabilities.map((p) => (
            <span
              key={p.id}
              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {p.name}
            </span>
          ))
        )}
      </div>

      {canManage ? (
        <SetCurrentProductForm
          assetId={assetId}
          capabilities={capabilities}
          currentProductId={currentProductId}
          disabled={retired}
        />
      ) : (
        <p className="text-sm">
          <span className="text-muted-foreground">Current product: </span>
          {currentProductName ?? "None"}
        </p>
      )}
      {canManage && retired && (
        <p className="text-xs text-muted-foreground">
          Retired assets can&apos;t have a product changeover.
        </p>
      )}

      {changeLogs.length > 0 && (
        <div className="space-y-1.5 border-t pt-3">
          <h3 className="text-xs font-medium text-muted-foreground">Changeover history</h3>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {changeLogs.map((log) => (
              <li key={log.id}>
                {log.productName ?? "Cleared"} — {log.changedByName},{" "}
                {log.changedAt.toLocaleDateString("en-PH", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
