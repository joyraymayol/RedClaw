"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  logMaterial,
  removeMaterial,
  type TicketActionState,
} from "@/lib/actions/tickets";
import { formatDateTimeParts } from "@/lib/format";

type Material = {
  id: string;
  name: string;
  quantity: string;
  unit: string | null;
  loggedByName: string;
  loggedAt: Date;
};

const initialState: TicketActionState = {};

export function TicketMaterialsCard({
  ticketId,
  materials,
  canLog,
}: {
  ticketId: string;
  materials: Material[];
  canLog: boolean;
}) {
  const [state, formAction, pending] = useActionState<TicketActionState, FormData>(
    logMaterial,
    initialState
  );
  const [removing, startRemove] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  function remove(materialId: string) {
    const data = new FormData();
    data.set("ticketId", ticketId);
    data.set("materialId", materialId);
    startRemove(async () => {
      await removeMaterial({}, data);
    });
  }

  return (
    <div className="space-y-3">
      {materials.length === 0 ? (
        <p className="text-sm text-muted-foreground">No materials logged.</p>
      ) : (
        <ul className="space-y-2">
          {materials.map((m) => {
            const ts = formatDateTimeParts(m.loggedAt);
            return (
              <li
                key={m.id}
                className="flex items-start justify-between gap-2 rounded-md border bg-muted/30 p-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {m.name}{" "}
                    <span className="text-muted-foreground">
                      · {m.quantity}
                      {m.unit ? ` ${m.unit}` : ""}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.loggedByName}, {ts.date}, {ts.time}
                  </p>
                </div>
                {canLog && (
                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    disabled={removing}
                    aria-label={`Remove ${m.name}`}
                    className="shrink-0 rounded-sm p-1 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2Icon className="size-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canLog && (
        <>
          {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
          <form
            ref={formRef}
            action={formAction}
            className="flex flex-wrap items-end gap-2"
            suppressHydrationWarning
          >
            <input type="hidden" name="ticketId" value={ticketId} />
            <Input
              name="name"
              placeholder="Material / part"
              required
              maxLength={160}
              className="min-w-40 flex-1"
            />
            <Input
              name="quantity"
              placeholder="Qty"
              required
              maxLength={60}
              className="w-20"
            />
            <Input name="unit" placeholder="Unit" maxLength={40} className="w-24" />
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Adding…" : "Log"}
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
