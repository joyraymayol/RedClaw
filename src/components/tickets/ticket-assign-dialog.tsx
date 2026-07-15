"use client";

import { useState, useTransition } from "react";
import { UserPlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
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
import { assignTicket, reassignTicket, type TicketActionState } from "@/lib/actions/tickets";

type TechnicianOption = { id: string; name: string };

export function TicketAssignDialog({
  ticketId,
  technicians,
  currentTechnicianId,
  isReassign = false,
}: {
  ticketId: string;
  technicians: TechnicianOption[];
  currentTechnicianId?: string | null;
  isReassign?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // base-ui's <Select.Value> needs an explicit items map to show a label
  // instead of the raw id once the popup (which registers labels) closes.
  const technicianItems = Object.fromEntries(technicians.map((t) => [t.id, t.name]));
  const action = isReassign ? reassignTicket : assignTicket;

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

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setError(null);
  }

  return (
    <>
      <Button variant={isReassign ? "outline" : "default"} onClick={() => setOpen(true)}>
        <UserPlusIcon className="size-4" />
        {isReassign ? "Reassign" : "Assign"}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isReassign ? "Reassign technician" : "Assign a technician"}</DialogTitle>
            <DialogDescription>
              A HIGH or CRITICAL ticket assigned to a technician who&apos;s
              already mid-repair will bump their current ticket to hold and
              start this one right away.
            </DialogDescription>
          </DialogHeader>

          {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
          <form action={submit} className="space-y-4" suppressHydrationWarning>
            <input type="hidden" name="ticketId" value={ticketId} />
            <div className="space-y-2">
              <Label htmlFor="technicianId">Technician</Label>
              <Select
                name="technicianId"
                items={technicianItems}
                defaultValue={currentTechnicianId ?? undefined}
                required
              >
                <SelectTrigger id="technicianId" className="w-full">
                  <SelectValue placeholder="Select a technician" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : isReassign ? "Reassign" : "Assign"}
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
