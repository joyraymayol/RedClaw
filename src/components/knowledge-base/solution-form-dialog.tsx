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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createSolution,
  deleteSolution,
  updateSolution,
  type SolutionActionState,
} from "@/lib/actions/solutions";
import type { Solution } from "@/generated/prisma/client";

type MachineOption = { id: string; assetCode: string; name: string };

export function SolutionFormDialog({
  problemTypeId,
  machines,
  solution,
}: {
  problemTypeId: string;
  machines: MachineOption[];
  solution?: Solution;
}) {
  const isEdit = !!solution;
  const [open, setOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const action = isEdit ? updateSolution : createSolution;
  // base-ui's <Select.Value> needs an explicit items map to show a label
  // instead of the raw id once the popup (which registers labels) closes.
  const machineItems = {
    __general__: "Any machine (general)",
    ...Object.fromEntries(machines.map((m) => [m.id, `${m.assetCode} — ${m.name}`])),
  };

  function submit(formData: FormData) {
    startTransition(async () => {
      const result: SolutionActionState = await action({}, formData);
      if (result.success) {
        setOpen(false);
        setError(null);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleDelete() {
    if (!solution) return;
    startTransition(async () => {
      const result = await deleteSolution(solution.id);
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
          aria-label={`Edit ${solution.title}`}
          onClick={() => setOpen(true)}
        >
          <PencilIcon className="size-4" />
        </Button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <PlusIcon className="size-3.5" />
          Add solution
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          {confirmingDelete && solution ? (
            <>
              <DialogHeader>
                <DialogTitle>Delete &quot;{solution.title}&quot;?</DialogTitle>
                <DialogDescription>
                  This can&apos;t be undone. If a ticket still references it
                  as its suggested solution, deletion will be blocked.
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
                <DialogTitle>{isEdit ? "Edit solution" : "Add solution"}</DialogTitle>
                <DialogDescription>
                  A curated fix requesters and technicians see when raising or
                  working a ticket of this problem type.
                </DialogDescription>
              </DialogHeader>

              {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
              <form action={submit} className="space-y-4" suppressHydrationWarning>
                <input type="hidden" name="problemTypeId" value={problemTypeId} />
                {isEdit && <input type="hidden" name="solutionId" value={solution.id} />}
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    name="title"
                    defaultValue={solution?.title}
                    placeholder="Replace worn drive belt"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="machineId">Applies to</Label>
                  <Select
                    name="machineId"
                    items={machineItems}
                    defaultValue={solution?.machineId ?? "__general__"}
                  >
                    <SelectTrigger id="machineId" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__general__">
                        Any machine (general)
                      </SelectItem>
                      {machines.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.assetCode} — {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={solution?.description}
                    placeholder="Steps a technician can follow"
                    required
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
                      {pending ? "Saving…" : isEdit ? "Save changes" : "Add solution"}
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
