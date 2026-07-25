"use client";

import { useState, useTransition } from "react";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  createProduct,
  deleteProduct,
  updateProduct,
  type ProductActionState,
} from "@/lib/actions/products";
import type { Product } from "@/generated/prisma/client";

export function ProductFormDialog({ product }: { product?: Product }) {
  const isEdit = !!product;
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const action = isEdit ? updateProduct : createProduct;

  function submit(formData: FormData) {
    startTransition(async () => {
      const result: ProductActionState = await action({}, formData);
      if (result.success) {
        setOpen(false);
        setError(null);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleDelete() {
    if (!product) return;
    startTransition(async () => {
      const result = await deleteProduct(product.id);
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
    if (!next) {
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
          aria-label={`Edit ${product.name}`}
          onClick={() => setOpen(true)}
        >
          <PencilIcon className="size-4" />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <PlusIcon className="size-4" />
          Add product
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          {confirmingDelete && product ? (
            <>
              <DialogHeader>
                <DialogTitle>Delete &quot;{product.name}&quot;?</DialogTitle>
                <DialogDescription>
                  This can&apos;t be undone. If any asset still lists it as a
                  capability or current product, deletion will be blocked.
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
                <DialogTitle>{isEdit ? "Edit product" : "Add product"}</DialogTitle>
                <DialogDescription>
                  Products a Production Machines asset can be flagged capable
                  of running, and switched between.
                </DialogDescription>
              </DialogHeader>

              {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
              {/* key: remount uncontrolled fields when the record's server data changes, instead of letting base-ui warn about defaultValue drifting on a mounted FieldControl */}
              <form
                key={product?.updatedAt.toISOString() ?? "new"}
                action={submit}
                className="space-y-4"
                suppressHydrationWarning
              >
                {isEdit && (
                  <input type="hidden" name="productId" value={product.id} />
                )}
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={product?.name}
                    placeholder="PET 2L Bottle"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={product?.description ?? ""}
                  />
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
                      {pending ? "Saving…" : isEdit ? "Save changes" : "Add product"}
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
