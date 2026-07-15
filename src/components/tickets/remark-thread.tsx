"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addRemark, type TicketActionState } from "@/lib/actions/tickets";

type Remark = {
  id: string;
  body: string;
  createdAt: Date;
  user: { name: string };
};

const initialState: TicketActionState = {};

export function RemarkThread({
  ticketId,
  remarks,
  canComment,
}: {
  ticketId: string;
  remarks: Remark[];
  canComment: boolean;
}) {
  const [state, formAction, pending] = useActionState<TicketActionState, FormData>(
    addRemark,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <div className="space-y-4">
      {remarks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No remarks yet.</p>
      ) : (
        <ul className="space-y-3">
          {remarks.map((r) => (
            <li key={r.id} className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{r.user.name}</span>
                <span className="text-xs text-muted-foreground">
                  {r.createdAt.toLocaleString("en-PH", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{r.body}</p>
            </li>
          ))}
        </ul>
      )}

      {canComment && (
        <>
          {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
          <form
            ref={formRef}
            action={formAction}
            className="space-y-2"
            suppressHydrationWarning
          >
            <input type="hidden" name="ticketId" value={ticketId} />
            <Textarea name="body" placeholder="Add a remark…" required maxLength={4000} />
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Posting…" : "Post remark"}
            </Button>
          </form>
          {state.error && (
            <p role="alert" className="text-xs text-destructive">
              {state.error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
