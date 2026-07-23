"use client";

import { useState, useTransition } from "react";
import { Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addApprover,
  removeApprover,
  type PlanActionState,
} from "@/lib/actions/production-plans";

type ApproverRow = { userId: string; name: string; email: string; departmentLabel: string };
type Candidate = { id: string; name: string; email: string };

export function ApproverManager({
  approvers,
  candidates,
}: {
  approvers: ApproverRow[];
  candidates: Candidate[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");

  const candidateItems = Object.fromEntries(
    candidates.map((c) => [c.id, `${c.name} · ${c.email}`])
  );

  function run(fn: () => Promise<PlanActionState>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setError(res.error);
      else {
        onOk?.();
        router.refresh();
      }
    });
  }

  function add() {
    if (!selected) return;
    const formData = new FormData();
    formData.set("userId", selected);
    run(() => addApprover({}, formData), () => setSelected(""));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-64 flex-1">
          <Select
            items={candidateItems}
            value={selected}
            onValueChange={(v) => setSelected(v ?? "")}
            disabled={candidates.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  candidates.length === 0 ? "No more users to add" : "Choose a user to add"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} · {c.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={add} disabled={pending || !selected}>
          Add approver
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive"
        >
          {error}
        </p>
      )}

      {approvers.length === 0 ? (
        <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
          No designated approvers yet — add at least one so plans can be approved.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {approvers.map((a) => (
            <li key={a.userId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{a.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.email} · {a.departmentLabel}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${a.name}`}
                onClick={() => run(() => removeApprover(a.userId))}
                disabled={pending}
              >
                <Trash2Icon className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
