"use client";

import { useState, useTransition } from "react";
import { UserPlusIcon, UsersIcon } from "lucide-react";

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
import { ScrollArea } from "@/components/ui/scroll-area";
import { assignTicket, updateAssignees, type TicketActionState } from "@/lib/actions/tickets";

type TechnicianOption = { id: string; name: string };

export function TicketAssignDialog({
  ticketId,
  technicians,
  currentAssigneeIds,
  mode,
}: {
  ticketId: string;
  technicians: TechnicianOption[];
  currentAssigneeIds: readonly string[];
  mode: "assign" | "manage";
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set(currentAssigneeIds));
  const isManage = mode === "manage";
  const action = isManage ? updateAssignees : assignTicket;

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setSelected(new Set(currentAssigneeIds));
    } else {
      setError(null);
    }
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
      const result: TicketActionState = await action({}, formData);
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
      <Button variant={isManage ? "outline" : "default"} onClick={() => handleOpenChange(true)}>
        {isManage ? <UsersIcon className="size-4" /> : <UserPlusIcon className="size-4" />}
        {isManage ? "Manage team" : "Assign"}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isManage ? "Update assigned technicians" : "Assign technicians"}</DialogTitle>
            <DialogDescription>
              {isManage
                ? "Add or remove team members. This doesn't change the ticket's status."
                : "A HIGH or CRITICAL ticket assigned to a technician who's already mid-repair will bump their current ticket to hold and start this one right away."}
            </DialogDescription>
          </DialogHeader>

          {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
          <form action={submit} className="space-y-4" suppressHydrationWarning>
            <input type="hidden" name="ticketId" value={ticketId} />
            {[...selected].map((id) => (
              <input key={id} type="hidden" name="technicianIds" value={id} />
            ))}
            <div className="space-y-2">
              <Label>Technicians</Label>
              <ScrollArea className="max-h-64 rounded-md border">
                <div className="space-y-1 p-2 pr-3">
                  {technicians.length === 0 && (
                    <p className="p-2 text-sm text-muted-foreground">No active technicians.</p>
                  )}
                  {technicians.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <Checkbox
                        checked={selected.has(t.id)}
                        onCheckedChange={(checked) => toggle(t.id, checked)}
                      />
                      {t.name}
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={pending || selected.size === 0}>
                {pending ? "Saving…" : isManage ? "Save team" : "Assign"}
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
