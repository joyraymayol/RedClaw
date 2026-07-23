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
import {
  createPmChecklistItem,
  deletePmChecklistItem,
  updatePmChecklistItem,
  type PmChecklistActionState,
} from "@/lib/actions/pm-checklists";

type Item = { id: string; label: string; sortOrder: number };

export function PmChecklistItemDialog({
  templateId,
  item,
}: {
  templateId: string;
  item?: Item;
}) {
  const isEdit = !!item;
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const action = isEdit ? updatePmChecklistItem : createPmChecklistItem;

  function submit(formData: FormData) {
    startTransition(async () => {
      const result: PmChecklistActionState = await action({}, formData);
      if (result.success) {
        setOpen(false);
        setError(null);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleDelete() {
    if (!item) return;
    startTransition(async () => {
      const result = await deletePmChecklistItem(item.id);
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
          aria-label={`Edit task`}
          onClick={() => setOpen(true)}
        >
          <PencilIcon className="size-4" />
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <PlusIcon className="size-3.5" />
          Add task
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          {confirmingDelete && item ? (
            <>
              <DialogHeader>
                <DialogTitle>Delete this task?</DialogTitle>
                <DialogDescription>
                  Removes it from the template. PM tickets already created keep
                  their snapshot of this task.
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
                <DialogTitle>{isEdit ? "Edit task" : "Add task"}</DialogTitle>
                <DialogDescription>
                  One line of the PM checklist a technician works through.
                </DialogDescription>
              </DialogHeader>

              {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
              <form action={submit} className="space-y-4" suppressHydrationWarning>
                <input type="hidden" name="templateId" value={templateId} />
                {isEdit && <input type="hidden" name="itemId" value={item.id} />}
                <div className="space-y-2">
                  <Label htmlFor="label">Task</Label>
                  <Input
                    id="label"
                    name="label"
                    defaultValue={item?.label}
                    placeholder="Check and top up hydraulic oil"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sortOrder">Order</Label>
                  <Input
                    id="sortOrder"
                    name="sortOrder"
                    type="number"
                    min={0}
                    defaultValue={item?.sortOrder ?? undefined}
                    placeholder="Leave blank to add at the end"
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
                      {pending ? "Saving…" : isEdit ? "Save changes" : "Add task"}
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
