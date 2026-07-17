"use client";

import { useActionState, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
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
import { createTicket, type TicketActionState } from "@/lib/actions/tickets";
import type { TicketPriority } from "@/generated/prisma/enums";

const PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

type AssetOption = { id: string; assetCode: string; name: string };
type ProblemTypeOption = { id: string; name: string };
type SolutionOption = {
  id: string;
  title: string;
  description: string;
  problemTypeId: string;
  assetId: string | null;
};

const initialState: TicketActionState = {};

export function TicketForm({
  assets,
  problemTypes,
  solutions,
}: {
  assets: AssetOption[];
  problemTypes: ProblemTypeOption[];
  solutions: SolutionOption[];
}) {
  const [state, formAction, pending] = useActionState<TicketActionState, FormData>(
    createTicket,
    initialState
  );
  const [assetId, setAssetId] = useState("");
  const [problemTypeId, setProblemTypeId] = useState("");

  const matchingSolutions = useMemo(() => {
    if (!problemTypeId) return [];
    return solutions
      .filter((s) => s.problemTypeId === problemTypeId)
      .sort((a) => (a.assetId === assetId ? -1 : 0));
  }, [solutions, problemTypeId, assetId]);

  // base-ui's <Select.Value> only shows a label instead of the raw stored
  // value when the Root is given an explicit items map — without it, the
  // trigger falls back to printing the id once the popup (which is what
  // registers each item's rendered label) closes.
  const assetItems = useMemo(
    () => Object.fromEntries(assets.map((a) => [a.id, `${a.assetCode} — ${a.name}`])),
    [assets]
  );
  const problemTypeItems = useMemo(
    () => Object.fromEntries(problemTypes.map((pt) => [pt.id, pt.name])),
    [problemTypes]
  );
  const solutionItems = useMemo(
    () =>
      Object.fromEntries(
        matchingSolutions.map((s) => [
          s.id,
          s.assetId === assetId ? `${s.title} (this asset)` : s.title,
        ])
      ),
    [matchingSolutions, assetId]
  );

  return (
    <>
      {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
      <form action={formAction} className="space-y-5" suppressHydrationWarning>
        <div className="space-y-2">
          <Label htmlFor="assetId">Asset</Label>
          <Select
            name="assetId"
            items={assetItems}
            value={assetId}
            onValueChange={(v) => setAssetId(v ?? "")}
            required
          >
            <SelectTrigger id="assetId" className="w-full">
              <SelectValue placeholder="Select an asset" />
            </SelectTrigger>
            <SelectContent>
              {assets.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.assetCode} — {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="problemTypeId">Problem type</Label>
          <Select
            name="problemTypeId"
            items={problemTypeItems}
            value={problemTypeId}
            onValueChange={(v) => setProblemTypeId(v ?? "")}
          >
            <SelectTrigger id="problemTypeId" className="w-full">
              <SelectValue placeholder="Optional — helps route the ticket" />
            </SelectTrigger>
            <SelectContent>
              {problemTypes.map((pt) => (
                <SelectItem key={pt.id} value={pt.id}>
                  {pt.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {matchingSolutions.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="suggestedSolutionId">Suggested solution</Label>
            <Select name="suggestedSolutionId" items={solutionItems}>
              <SelectTrigger id="suggestedSolutionId" className="w-full">
                <SelectValue placeholder="None — pick one if it looks right" />
              </SelectTrigger>
              <SelectContent>
                {matchingSolutions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                    {s.assetId === assetId ? " (this asset)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select name="priority" defaultValue="MEDIUM" required>
              <SelectTrigger id="priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              placeholder="Short summary"
              minLength={5}
              maxLength={120}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            placeholder="What happened, when you noticed it, symptoms…"
            minLength={10}
            maxLength={4000}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Submitting…" : "Submit ticket"}
        </Button>
      </form>
      {state.error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive"
        >
          {state.error}
        </p>
      )}
    </>
  );
}
