"use client";

import { useActionState, useMemo, useState } from "react";
import { XIcon } from "lucide-react";

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
import { TICKET_TYPE_LABELS } from "@/components/tickets/ticket-type-badge";
import { createTicket, type TicketActionState } from "@/lib/actions/tickets";
import type { TicketPriority, TicketType } from "@/generated/prisma/enums";

const PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

/** Small "x" affordance layered onto a Select trigger's padding so a value
    can be cleared without opening the popup — base-ui's Select has no
    built-in clear control. */
function ClearSelectButton({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClear();
      }}
      aria-label={`Clear ${label}`}
      className="absolute top-1/2 right-7 z-10 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground"
    >
      <XIcon className="size-3.5" />
    </button>
  );
}

type CategoryOption = { id: string; name: string };
type AssetOption = { id: string; assetCode: string; name: string; categoryId: string };
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
  categories,
  assets,
  problemTypes,
  solutions,
  allowedTypes,
  productsByAsset,
}: {
  categories: CategoryOption[];
  assets: AssetOption[];
  problemTypes: ProblemTypeOption[];
  solutions: SolutionOption[];
  /** Ticket types this user is allowed to raise (from canCreateTicketType). */
  allowedTypes: TicketType[];
  /** Per-asset product capabilities — for the MACHINE_SETUP target-mold picker. */
  productsByAsset: Record<string, { id: string; name: string }[]>;
}) {
  const [state, formAction, pending] = useActionState<TicketActionState, FormData>(
    createTicket,
    initialState
  );
  const [type, setType] = useState<TicketType>(allowedTypes[0] ?? "MAINTENANCE");
  const [categoryId, setCategoryId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [problemTypeId, setProblemTypeId] = useState("");
  const [solutionId, setSolutionId] = useState("");
  const [targetProductId, setTargetProductId] = useState("");
  const [priority, setPriority] = useState<TicketPriority | "">("MEDIUM");

  const assetsInCategory = useMemo(
    () => assets.filter((a) => a.categoryId === categoryId),
    [assets, categoryId]
  );

  const targetProducts = useMemo(
    () => (assetId ? productsByAsset[assetId] ?? [] : []),
    [productsByAsset, assetId]
  );
  const targetProductItems = useMemo(
    () => Object.fromEntries(targetProducts.map((p) => [p.id, p.name])),
    [targetProducts]
  );

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
  const categoryItems = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c.name])),
    [categories]
  );
  const assetItems = useMemo(
    () => Object.fromEntries(assetsInCategory.map((a) => [a.id, `${a.assetCode} — ${a.name}`])),
    [assetsInCategory]
  );
  const problemTypeItems = useMemo(
    () => Object.fromEntries(problemTypes.map((pt) => [pt.id, pt.name])),
    [problemTypes]
  );
  const typeItems = useMemo(
    () => Object.fromEntries(allowedTypes.map((t) => [t, TICKET_TYPE_LABELS[t]])),
    [allowedTypes]
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
        {allowedTypes.length > 1 ? (
          <div className="space-y-2">
            <Label htmlFor="type">Ticket type</Label>
            <Select
              name="type"
              items={typeItems}
              value={type}
              onValueChange={(v) => setType((v as TicketType) ?? "MAINTENANCE")}
              required
            >
              <SelectTrigger id="type" className="w-full">
                <SelectValue placeholder="Choose a ticket type" />
              </SelectTrigger>
              <SelectContent>
                {allowedTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TICKET_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <input type="hidden" name="type" value={type} />
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="categoryId">Category</Label>
            <div className="relative">
              <Select
                name="categoryId"
                items={categoryItems}
                value={categoryId}
                onValueChange={(v) => {
                  const next = v ?? "";
                  setCategoryId(next);
                  setAssetId("");
                  setTargetProductId("");
                }}
                required
              >
                <SelectTrigger id="categoryId" className="w-full">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categoryId && (
                <ClearSelectButton
                  label="category"
                  onClear={() => {
                    setCategoryId("");
                    setAssetId("");
                    setTargetProductId("");
                  }}
                />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="assetId">Asset</Label>
            <div className="relative">
              <Select
                name="assetId"
                items={assetItems}
                value={assetId}
                onValueChange={(v) => {
                  setAssetId(v ?? "");
                  setTargetProductId("");
                }}
                disabled={!categoryId}
                required
              >
                <SelectTrigger id="assetId" className="w-full">
                  <SelectValue placeholder="Select an asset" />
                </SelectTrigger>
                <SelectContent>
                  {assetsInCategory.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.assetCode} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {assetId && (
                <ClearSelectButton
                  label="asset"
                  onClear={() => {
                    setAssetId("");
                    setTargetProductId("");
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {type === "MACHINE_SETUP" && assetId && (
          <div className="space-y-2">
            <Label htmlFor="targetProductId">Target product (mold)</Label>
            <div className="relative">
              <Select
                name="targetProductId"
                items={targetProductItems}
                value={targetProductId}
                onValueChange={(v) => setTargetProductId(v ?? "")}
                disabled={targetProducts.length === 0}
              >
                <SelectTrigger id="targetProductId" className="w-full">
                  <SelectValue
                    placeholder={
                      targetProducts.length === 0
                        ? "This machine has no product capabilities"
                        : "Optional — the mold to switch to on completion"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {targetProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {targetProductId && (
                <ClearSelectButton
                  label="target product"
                  onClear={() => setTargetProductId("")}
                />
              )}
            </div>
          </div>
        )}

        {type === "MAINTENANCE" && (
          <div className="space-y-2">
            <Label htmlFor="problemTypeId">Problem type</Label>
            <div className="relative">
              <Select
                name="problemTypeId"
                items={problemTypeItems}
                value={problemTypeId}
                onValueChange={(v) => {
                  setProblemTypeId(v ?? "");
                  setSolutionId("");
                }}
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
              {problemTypeId && (
                <ClearSelectButton
                  label="problem type"
                  onClear={() => {
                    setProblemTypeId("");
                    setSolutionId("");
                  }}
                />
              )}
            </div>
          </div>
        )}

        {type === "MAINTENANCE" && matchingSolutions.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="suggestedSolutionId">Suggested solution</Label>
            <div className="relative">
              <Select
                name="suggestedSolutionId"
                items={solutionItems}
                value={solutionId}
                onValueChange={(v) => setSolutionId(v ?? "")}
              >
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
              {solutionId && (
                <ClearSelectButton label="suggested solution" onClear={() => setSolutionId("")} />
              )}
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <div className="relative">
              <Select
                name="priority"
                value={priority}
                onValueChange={(v) => setPriority((v as TicketPriority) ?? "")}
                required
              >
                <SelectTrigger id="priority" className="w-full">
                  <SelectValue placeholder="Select a priority" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {priority && (
                <ClearSelectButton label="priority" onClear={() => setPriority("")} />
              )}
            </div>
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
