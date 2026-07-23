"use client";

import { useMemo, useState, useTransition } from "react";
import { TagsIcon } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { updateTicketAssets, type TicketActionState } from "@/lib/actions/tickets";

type AssetOption = { id: string; assetCode: string; name: string; categoryId: string; categoryName: string };

export function TicketFlagDialog({
  ticketId,
  assets,
  currentAssetIds,
}: {
  ticketId: string;
  assets: AssetOption[];
  currentAssetIds: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set(currentAssetIds));

  const groups = useMemo(() => {
    const byCategory = new Map<string, { categoryName: string; assets: AssetOption[] }>();
    for (const a of assets) {
      const group = byCategory.get(a.categoryId);
      if (group) group.assets.push(a);
      else byCategory.set(a.categoryId, { categoryName: a.categoryName, assets: [a] });
    }
    return [...byCategory.values()].sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  }, [assets]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setSelected(new Set(currentAssetIds));
    else setError(null);
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
      const result: TicketActionState = await updateTicketAssets({}, formData);
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
      <Button variant="outline" onClick={() => handleOpenChange(true)}>
        <TagsIcon className="size-4" />
        Re-flag assets
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Re-flag assets</DialogTitle>
            <DialogDescription>
              Which assets this ticket is raised against. Pick at least one.
            </DialogDescription>
          </DialogHeader>

          {/* suppressHydrationWarning: Chrome iOS injects __gcruniqueid into forms */}
          <form action={submit} className="space-y-4" suppressHydrationWarning>
            <input type="hidden" name="ticketId" value={ticketId} />
            {[...selected].map((id) => (
              <input key={id} type="hidden" name="assetIds" value={id} />
            ))}
            <ScrollArea className="max-h-72 rounded-md border">
              <div className="space-y-3 p-2 pr-3">
                {groups.length === 0 && (
                  <p className="p-2 text-sm text-muted-foreground">No non-retired assets available.</p>
                )}
                {groups.map((group) => (
                  <div key={group.categoryName} className="space-y-1">
                    <Label className="px-2 text-xs text-muted-foreground">{group.categoryName}</Label>
                    {group.assets.map((a) => (
                      <label
                        key={a.id}
                        className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <Checkbox
                          checked={selected.has(a.id)}
                          onCheckedChange={(checked) => toggle(a.id, checked === true)}
                        />
                        {a.assetCode} — {a.name}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" type="button" />}>
                Cancel
              </DialogClose>
              <Button type="submit" disabled={pending || selected.size === 0}>
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
