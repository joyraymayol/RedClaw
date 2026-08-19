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
  updateTemplateAssets,
  type PmChecklistActionState,
} from "@/lib/actions/pm-checklists";

type AssetOption = { id: string; assetCode: string; name: string };

export function PmChecklistAssetsDialog({
  templateId,
  allAssets,
  currentAssetIds,
}: {
  templateId: string;
  allAssets: AssetOption[];
  currentAssetIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set(currentAssetIds));
  const [query, setQuery] = useState("");

  const filteredAssets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allAssets;
    return allAssets.filter(
      (a) => a.assetCode.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    );
  }, [allAssets, query]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setSelected(new Set(currentAssetIds));
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
      const result: PmChecklistActionState = await updateTemplateAssets({}, formData);
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
        Manage assets
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assets using this checklist</DialogTitle>
            <DialogDescription>
              Which machines carry this checklist. A PM ticket raised on one
              of these can pick it.
            </DialogDescription>
          </DialogHeader>

          {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
          <form action={submit} className="space-y-4" suppressHydrationWarning>
            <input type="hidden" name="templateId" value={templateId} />
            {[...selected].map((id) => (
              <input key={id} type="hidden" name="assetIds" value={id} />
            ))}
            {allAssets.length > 0 && (
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search assets…"
                  aria-label="Search assets"
                  className="pl-8"
                />
              </div>
            )}
            <ScrollArea className="max-h-64 rounded-md border">
              <div className="space-y-1 p-2 pr-3">
                {allAssets.length === 0 && (
                  <p className="p-2 text-sm text-muted-foreground">
                    No assets yet.
                  </p>
                )}
                {allAssets.length > 0 && filteredAssets.length === 0 && (
                  <p className="p-2 text-sm text-muted-foreground">
                    No assets match &ldquo;{query}&rdquo;.
                  </p>
                )}
                {filteredAssets.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <Checkbox
                      checked={selected.has(a.id)}
                      onCheckedChange={(checked) => toggle(a.id, checked === true)}
                    />
                    <span className="font-mono text-xs text-muted-foreground">
                      {a.assetCode}
                    </span>
                    {a.name}
                  </label>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save assets"}
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
