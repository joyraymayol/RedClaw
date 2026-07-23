"use client";

import { useState, useTransition } from "react";
import { CheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { updateChecklistResult } from "@/lib/actions/pm-checklists";
import { formatDateTimeParts } from "@/lib/format";

type ChecklistResult = {
  id: string;
  label: string;
  done: boolean;
  remark: string | null;
  checkedByName: string | null;
  checkedAt: Date | null;
};

function ChecklistItemRow({
  ticketId,
  result,
  canEdit,
}: {
  ticketId: string;
  result: ChecklistResult;
  canEdit: boolean;
}) {
  const [done, setDone] = useState(result.done);
  const [remark, setRemark] = useState(result.remark ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dirty = done !== result.done || remark !== (result.remark ?? "");

  function save() {
    setError(null);
    const data = new FormData();
    data.set("ticketId", ticketId);
    data.set("resultId", result.id);
    data.set("done", String(done));
    data.set("remark", remark);
    startTransition(async () => {
      const res = await updateChecklistResult({}, data);
      if (res.error) setError(res.error);
    });
  }

  return (
    <li className="space-y-1.5 rounded-md border p-3">
      <div className="flex items-start gap-2.5">
        <Checkbox
          checked={done}
          onCheckedChange={(v) => setDone(v === true)}
          disabled={!canEdit || pending}
          className="mt-0.5"
          aria-label={result.label}
        />
        <div className="min-w-0 flex-1">
          <p className={done ? "text-sm text-muted-foreground line-through" : "text-sm"}>
            {result.label}
          </p>
          {result.checkedByName && result.checkedAt && (
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              {(() => {
                const ts = formatDateTimeParts(result.checkedAt);
                return `${result.checkedByName}, ${ts.date}, ${ts.time}`;
              })()}
            </p>
          )}
        </div>
      </div>
      {canEdit ? (
        <div className="flex items-center gap-2 pl-7">
          <Input
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Remark (optional)"
            maxLength={500}
            className="h-8 flex-1 text-sm"
          />
          <Button type="button" size="sm" variant="outline" onClick={save} disabled={!dirty || pending}>
            <CheckIcon className="size-3.5" />
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : (
        result.remark && <p className="pl-7 text-xs text-muted-foreground">{result.remark}</p>
      )}
      {error && (
        <p role="alert" className="pl-7 text-xs text-destructive">
          {error}
        </p>
      )}
    </li>
  );
}

export function TicketChecklistCard({
  ticketId,
  results,
  canEdit,
}: {
  ticketId: string;
  results: ChecklistResult[];
  canEdit: boolean;
}) {
  const doneCount = results.filter((r) => r.done).length;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {doneCount} of {results.length} done
      </p>
      <ul className="space-y-2">
        {results.map((r) => (
          <ChecklistItemRow key={r.id} ticketId={ticketId} result={r} canEdit={canEdit} />
        ))}
      </ul>
    </div>
  );
}
