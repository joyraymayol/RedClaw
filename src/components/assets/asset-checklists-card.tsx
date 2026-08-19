"use client";

import { useMemo, useState, useTransition } from "react";
import { SearchIcon } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  updateAssetChecklists,
  type AssetActionState,
} from "@/lib/actions/assets";

type TemplateOption = { id: string; name: string };

function ChecklistsDialog({
  assetId,
  allTemplates,
  currentTemplateIds,
}: {
  assetId: string;
  allTemplates: TemplateOption[];
  currentTemplateIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set(currentTemplateIds));
  const [query, setQuery] = useState("");

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allTemplates;
    return allTemplates.filter((t) => t.name.toLowerCase().includes(q));
  }, [allTemplates, query]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setSelected(new Set(currentTemplateIds));
      setQuery("");
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
      const result: AssetActionState = await updateAssetChecklists({}, formData);
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
      <Button variant="outline" size="sm" onClick={() => handleOpenChange(true)}>
        Edit checklists
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>PM checklists</DialogTitle>
            <DialogDescription>
              Which checklists this asset carries. A PM ticket raised on it can
              pick from these.
            </DialogDescription>
          </DialogHeader>

          {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
          <form action={submit} className="space-y-4" suppressHydrationWarning>
            <input type="hidden" name="assetId" value={assetId} />
            {[...selected].map((id) => (
              <input key={id} type="hidden" name="templateIds" value={id} />
            ))}
            {allTemplates.length > 0 && (
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search checklists…"
                  aria-label="Search checklists"
                  className="pl-8"
                />
              </div>
            )}
            <ScrollArea className="max-h-64 rounded-md border">
              <div className="space-y-1 p-2 pr-3">
                {allTemplates.length === 0 && (
                  <p className="p-2 text-sm text-muted-foreground">
                    No checklists yet — add some on the PM checklists page.
                  </p>
                )}
                {allTemplates.length > 0 && filteredTemplates.length === 0 && (
                  <p className="p-2 text-sm text-muted-foreground">
                    No checklists match &ldquo;{query}&rdquo;.
                  </p>
                )}
                {filteredTemplates.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      checked={selected.has(t.id)}
                      onCheckedChange={(checked) => toggle(t.id, checked === true)}
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save checklists"}
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

export function AssetChecklistsCard({
  assetId,
  canManage,
  allTemplates,
  templates,
}: {
  assetId: string;
  canManage: boolean;
  allTemplates: TemplateOption[];
  templates: TemplateOption[];
}) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">PM checklists</h2>
        {canManage && (
          <ChecklistsDialog
            assetId={assetId}
            allTemplates={allTemplates}
            currentTemplateIds={templates.map((t) => t.id)}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No checklists attached.</p>
        ) : (
          templates.map((t) => (
            <span
              key={t.id}
              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {t.name}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
