"use client";

import { useMemo, useState, useTransition } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createAsset,
  updateAsset,
  type AssetActionState,
} from "@/lib/actions/assets";
import type { Asset, AssetStatus } from "@/generated/prisma/client";

const STATUSES: AssetStatus[] = ["OPERATIONAL", "DOWN", "UNDER_MAINTENANCE"];

const STATUS_LABEL: Record<AssetStatus, string> = {
  OPERATIONAL: "Operational",
  DOWN: "Down",
  UNDER_MAINTENANCE: "Under maintenance",
  RETIRED: "Retired",
};

type CategoryOption = { id: string; name: string; supportsParentAsset: boolean };
type TypeOption = { id: string; name: string; categoryId: string };
type AssetOption = { id: string; assetCode: string; name: string; categoryId: string; status: AssetStatus };
type TemplateOption = { id: string; name: string };

export function AssetFormDialog({
  asset,
  categories,
  types,
  assets,
  checklistTemplates,
}: {
  asset?: Asset;
  categories: CategoryOption[];
  types: TypeOption[];
  assets: AssetOption[];
  checklistTemplates: TemplateOption[];
}) {
  const isEdit = !!asset;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const action = isEdit ? updateAsset : createAsset;

  const [categoryId, setCategoryId] = useState(asset?.categoryId ?? "");
  const [typeId, setTypeId] = useState(asset?.typeId ?? "__none__");
  const [parentAssetId, setParentAssetId] = useState(asset?.parentAssetId ?? "__none__");
  const [pmTemplateId, setPmTemplateId] = useState(asset?.pmChecklistTemplateId ?? "__none__");

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const typesInCategory = useMemo(
    () => types.filter((t) => t.categoryId === categoryId),
    [types, categoryId]
  );
  const parentCandidates = useMemo(
    () => assets.filter((a) => a.id !== asset?.id && a.status !== "RETIRED"),
    [assets, asset?.id]
  );

  const categoryItems = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories]
  );
  const typeItems = useMemo(
    () => ({
      __none__: "None",
      ...Object.fromEntries(typesInCategory.map((t) => [t.id, t.name])),
    }),
    [typesInCategory]
  );
  const parentItems = useMemo(
    () => ({
      __none__: "None",
      ...Object.fromEntries(parentCandidates.map((a) => [a.id, `${a.assetCode} — ${a.name}`])),
    }),
    [parentCandidates]
  );
  const templateItems = useMemo(
    () => ({
      __none__: "None",
      ...Object.fromEntries(checklistTemplates.map((t) => [t.id, t.name])),
    }),
    [checklistTemplates]
  );

  function resetFromAsset() {
    setCategoryId(asset?.categoryId ?? "");
    setTypeId(asset?.typeId ?? "__none__");
    setParentAssetId(asset?.parentAssetId ?? "__none__");
    setPmTemplateId(asset?.pmChecklistTemplateId ?? "__none__");
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      const result: AssetActionState = await action({}, formData);
      if (result.success) {
        setOpen(false);
        setError(null);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) resetFromAsset();
    else setError(null);
  }

  return (
    <>
      {isEdit ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${asset.name}`}
          onClick={() => handleOpenChange(true)}
        >
          <PencilIcon className="size-4" />
        </Button>
      ) : (
        <Button onClick={() => handleOpenChange(true)}>
          <PlusIcon className="size-4" />
          Add asset
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit asset" : "Add asset"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update this asset's details."
                : "Register a new asset that tickets can be raised against."}
            </DialogDescription>
          </DialogHeader>

          {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
          {/* key: remount uncontrolled fields (defaultValue) when the record's server data actually changes, instead of letting base-ui warn about defaultValue drifting on a mounted FieldControl */}
          <form
            key={asset?.updatedAt.toISOString() ?? "new"}
            action={submit}
            className="space-y-4"
            suppressHydrationWarning
          >
            {isEdit && (
              <input type="hidden" name="assetId" value={asset.id} />
            )}
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="assetCode">Asset code</Label>
                    <Input
                      id="assetCode"
                      name="assetCode"
                      defaultValue={asset?.assetCode}
                      placeholder="CNC-014"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      name="status"
                      items={STATUS_LABEL}
                      defaultValue={asset?.status ?? "OPERATIONAL"}
                      required
                    >
                      <SelectTrigger id="status" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={asset?.name}
                    placeholder="CNC Mill #3"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="categoryId">Category</Label>
                    <Select
                      name="categoryId"
                      items={categoryItems}
                      value={categoryId}
                      onValueChange={(v) => {
                        const next = v ?? "";
                        setCategoryId(next);
                        setTypeId("__none__");
                        if (!categories.find((c) => c.id === next)?.supportsParentAsset) {
                          setParentAssetId("__none__");
                        }
                      }}
                      required
                    >
                      <SelectTrigger id="categoryId" className="w-full">
                        <SelectValue placeholder="Choose a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="typeId">Type</Label>
                    <Select
                      name="typeId"
                      items={typeItems}
                      value={typeId}
                      onValueChange={(v) => setTypeId(v ?? "__none__")}
                      disabled={!categoryId}
                    >
                      <SelectTrigger id="typeId" className="w-full">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {typesInCategory.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedCategory?.supportsParentAsset && (
                  <div className="space-y-2">
                    <Label htmlFor="parentAssetId">Parent asset</Label>
                    <Select
                      name="parentAssetId"
                      items={parentItems}
                      value={parentAssetId}
                      onValueChange={(v) => setParentAssetId(v ?? "__none__")}
                    >
                      <SelectTrigger id="parentAssetId" className="w-full">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {parentCandidates.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.assetCode} — {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      name="location"
                      defaultValue={asset?.location ?? ""}
                      placeholder="Bay 3"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pmChecklistTemplateId">PM checklist</Label>
                    <Select
                      name="pmChecklistTemplateId"
                      items={templateItems}
                      value={pmTemplateId}
                      onValueChange={(v) => setPmTemplateId(v ?? "__none__")}
                    >
                      <SelectTrigger id="pmChecklistTemplateId" className="w-full">
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {checklistTemplates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="serialNumber">Serial number</Label>
                    <Input
                      id="serialNumber"
                      name="serialNumber"
                      defaultValue={asset?.serialNumber ?? ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manufacturer">Manufacturer</Label>
                    <Input
                      id="manufacturer"
                      name="manufacturer"
                      defaultValue={asset?.manufacturer ?? ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">Model</Label>
                    <Input id="model" name="model" defaultValue={asset?.model ?? ""} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="purchaseDate">Purchased</Label>
                    <DateField
                      id="purchaseDate"
                      name="purchaseDate"
                      defaultValue={asset?.purchaseDate}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="installedAt">Installed</Label>
                    <DateField
                      id="installedAt"
                      name="installedAt"
                      defaultValue={asset?.installedAt}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="commissionedAt">Commissioned</Label>
                    <DateField
                      id="commissionedAt"
                      name="commissionedAt"
                      defaultValue={asset?.commissionedAt}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="warrantyExpiresAt">Warranty expires</Label>
                    <DateField
                      id="warrantyExpiresAt"
                      name="warrantyExpiresAt"
                      defaultValue={asset?.warrantyExpiresAt}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    defaultValue={asset?.notes ?? ""}
                    placeholder="Anything worth knowing at a glance"
                  />
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : "Add asset"}
              </Button>
            </DialogFooter>
            {error && (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive"
              >
                {error}
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
