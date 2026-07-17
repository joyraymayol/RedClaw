"use client";

import { useState, useTransition } from "react";
import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";

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
import { retireAsset, unretireAsset } from "@/lib/actions/assets";

export function AssetRetireButton({
  assetId,
  assetName,
  retired,
}: {
  assetId: string;
  assetName: string;
  retired: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setError(null);
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await (retired ? unretireAsset(assetId) : retireAsset(assetId));
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
      <Button variant="outline" onClick={() => setOpen(true)}>
        {retired ? (
          <ArchiveRestoreIcon className="size-4" />
        ) : (
          <ArchiveIcon className="size-4" />
        )}
        {retired ? "Unretire" : "Retire"}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {retired ? `Unretire "${assetName}"?` : `Retire "${assetName}"?`}
            </DialogTitle>
            <DialogDescription>
              {retired
                ? "This asset becomes operational again and can be raised against."
                : "Retired assets are excluded from the new-ticket picker and product changeover, and shown with a badge in lists."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button
              variant={retired ? "default" : "destructive"}
              onClick={handleConfirm}
              disabled={pending}
            >
              {pending ? "Saving…" : retired ? "Yes, unretire it" : "Yes, retire it"}
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
        </DialogContent>
      </Dialog>
    </>
  );
}
