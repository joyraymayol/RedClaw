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
  createPmChecklistTemplate,
  deletePmChecklistTemplate,
  updatePmChecklistTemplate,
  type PmChecklistActionState,
} from "@/lib/actions/pm-checklists";

type Template = { id: string; name: string; description: string | null };

export function PmChecklistTemplateDialog({ template }: { template?: Template }) {
  const isEdit = !!template;
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const action = isEdit ? updatePmChecklistTemplate : createPmChecklistTemplate;

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
    if (!template) return;
    startTransition(async () => {
      const result = await deletePmChecklistTemplate(template.id);
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
          aria-label={`Edit ${template.name}`}
          onClick={() => setOpen(true)}
        >
          <PencilIcon className="size-4" />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <PlusIcon className="size-4" />
          Add checklist
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          {confirmingDelete && template ? (
            <>
              <DialogHeader>
                <DialogTitle>Delete &quot;{template.name}&quot;?</DialogTitle>
                <DialogDescription>
                  This removes the checklist and its items. Machines using it as
                  their default lose the assignment; already-created PM tickets
                  keep their snapshot.
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
                <DialogTitle>{isEdit ? "Edit checklist" : "Add checklist"}</DialogTitle>
                <DialogDescription>
                  A reusable list of PM tasks you can attach to one or many
                  machines.
                </DialogDescription>
              </DialogHeader>

              {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
              <form action={submit} className="space-y-4" suppressHydrationWarning>
                {isEdit && <input type="hidden" name="templateId" value={template.id} />}
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    key={template?.name ?? "new"}
                    id="name"
                    name="name"
                    defaultValue={template?.name}
                    placeholder="Injection molder — monthly PM"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    key={template?.description ?? "new"}
                    id="description"
                    name="description"
                    defaultValue={template?.description ?? ""}
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
                      {pending ? "Saving…" : isEdit ? "Save changes" : "Add checklist"}
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
