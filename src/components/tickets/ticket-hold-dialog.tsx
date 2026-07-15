"use client";

import { useState, useTransition } from "react";
import { PauseIcon } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { holdTicket, type TicketActionState } from "@/lib/actions/tickets";

const REASON_LABEL: Record<string, string> = {
  WAITING_PARTS: "Waiting on parts",
  WAITING_VENDOR: "Waiting on a vendor",
  OTHER: "Other",
};

export function TicketHoldDialog({ ticketId }: { ticketId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result: TicketActionState = await holdTicket({}, formData);
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
      <Button variant="outline" onClick={() => setOpen(true)}>
        <PauseIcon className="size-4" />
        Hold
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Put this ticket on hold</DialogTitle>
            <DialogDescription>
              Frees you up to start another ticket. Resume it any time.
            </DialogDescription>
          </DialogHeader>

          {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
          <form action={submit} className="space-y-4" suppressHydrationWarning>
            <input type="hidden" name="ticketId" value={ticketId} />
            <div className="space-y-2">
              <Label htmlFor="holdReason">Reason</Label>
              <Select
                name="holdReason"
                items={REASON_LABEL}
                defaultValue="WAITING_PARTS"
                required
              >
                <SelectTrigger id="holdReason" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REASON_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                name="note"
                placeholder="What are you waiting on?"
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Put on hold"}
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
