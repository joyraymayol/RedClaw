"use client";

import { useState, useTransition } from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createAssetCategory,
  deleteAssetCategory,
  updateAssetCategory,
  type AssetCategoryActionState,
} from "@/lib/actions/asset-categories";
import type { AssetCategory } from "@/generated/prisma/client";

export function AssetCategoryFormDialog({ category }: { category?: AssetCategory }) {
  const isEdit = !!category;
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const action = isEdit ? updateAssetCategory : createAssetCategory;

  const [tracksProducts, setTracksProducts] = useState(category?.tracksProducts ?? false);
  const [supportsParentAsset, setSupportsParentAsset] = useState(
    category?.supportsParentAsset ?? false
  );

  function submit(formData: FormData) {
    startTransition(async () => {
      const result: AssetCategoryActionState = await action({}, formData);
      if (result.success) {
        setOpen(false);
        setError(null);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleDelete() {
    if (!category) return;
    startTransition(async () => {
      const result = await deleteAssetCategory(category.id);
      if (result.success) {
        setOpen(false);
        setError(null);
      } else {
        setConfirmingDelete(false);
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setTracksProducts(category?.tracksProducts ?? false);
      setSupportsParentAsset(category?.supportsParentAsset ?? false);
    } else {
      setError(null);
      setConfirmingDelete(false);
    }
  }

  return (
    <>
      {isEdit ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${category.name}`}
          onClick={() => handleOpenChange(true)}
        >
          <PencilIcon className="size-4" />
        </Button>
      ) : (
        <Button onClick={() => handleOpenChange(true)}>
          <PlusIcon className="size-4" />
          Add category
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          {confirmingDelete && category ? (
            <>
              <DialogHeader>
                <DialogTitle>Delete &quot;{category.name}&quot;?</DialogTitle>
                <DialogDescription>
                  This can&apos;t be undone. If any assets or asset types still
                  reference it, deletion will be blocked.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={pending}>
                  {pending ? "Deleting…" : "Yes, delete it"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{isEdit ? "Edit category" : "Add category"}</DialogTitle>
                <DialogDescription>
                  Categories group assets and drive category-specific behavior
                  on the asset form.
                </DialogDescription>
              </DialogHeader>

              {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
              <form action={submit} className="space-y-4" suppressHydrationWarning>
                {isEdit && (
                  <input type="hidden" name="categoryId" value={category.id} />
                )}
                <input type="hidden" name="tracksProducts" value={String(tracksProducts)} />
                <input
                  type="hidden"
                  name="supportsParentAsset"
                  value={String(supportsParentAsset)}
                />
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={category?.name}
                    placeholder="Production Machines"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={category?.description ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={tracksProducts}
                      onCheckedChange={(checked) => setTracksProducts(checked === true)}
                    />
                    Tracks products (shows the Products card on assets)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={supportsParentAsset}
                      onCheckedChange={(checked) => setSupportsParentAsset(checked === true)}
                    />
                    Supports a parent asset (offers a parent picker on assets)
                  </label>
                </div>
                <DialogFooter className={isEdit ? "sm:justify-between" : undefined}>
                  {isEdit && (
                    <Button
                      variant="destructive"
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      disabled={pending}
                    >
                      <Trash2Icon className="size-3.5" />
                      Delete
                    </Button>
                  )}
                  <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <DialogClose render={<Button variant="outline" type="button" />}>
                      Cancel
                    </DialogClose>
                    <Button type="submit" disabled={pending}>
                      {pending ? "Saving…" : isEdit ? "Save changes" : "Add category"}
                    </Button>
                  </div>
                </DialogFooter>
              </form>
            </>
          )}
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
