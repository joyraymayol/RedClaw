"use client";

import { useState, useTransition } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import type { TicketActionState } from "@/lib/actions/tickets";

/** A ticketId + note action behind a confirmation dialog — reopen, reject-review, cancel. */
export function TicketNoteDialog({
  action,
  ticketId,
  triggerLabel,
  triggerIcon,
  triggerVariant = "default",
  title,
  description,
  notePlaceholder,
  noteRequired = true,
  submitLabel,
}: {
  action: (prevState: TicketActionState, formData: FormData) => Promise<TicketActionState>;
  ticketId: string;
  triggerLabel: string;
  triggerIcon?: React.ReactNode;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost" | "destructive";
  title: string;
  description: string;
  notePlaceholder?: string;
  noteRequired?: boolean;
  submitLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await action({}, formData);
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
      <Button variant={triggerVariant} onClick={() => setOpen(true)}>
        {triggerIcon}
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
          <form action={submit} className="space-y-4" suppressHydrationWarning>
            <input type="hidden" name="ticketId" value={ticketId} />
            <div className="space-y-2">
              <Label htmlFor="note">
                Note {noteRequired ? "" : "(optional)"}
              </Label>
              <Textarea
                id="note"
                name="note"
                placeholder={notePlaceholder}
                required={noteRequired}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Submitting…" : submitLabel}
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
