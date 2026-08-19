"use client";

import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";

import { PmChecklistItemDialog } from "@/components/pm-checklists/pm-checklist-item-dialog";
import { PmChecklistTemplateDialog } from "@/components/pm-checklists/pm-checklist-template-dialog";
import { TableCell, TableRow } from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";

type Template = Prisma.PmChecklistTemplateGetPayload<{ include: { items: true } }>;

/** Table-view row for a PM checklist template — expands in place to the
    same task list Card view shows, instead of linking out to a detail page
    (there isn't one). */
export function PmChecklistTemplateTableRow({ template: t }: { template: Template }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <TableCell>
          <ChevronRightIcon
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              open && "rotate-90"
            )}
          />
        </TableCell>
        <TableCell className="font-medium">{t.name}</TableCell>
        <TableCell className="hidden max-w-xs truncate text-muted-foreground lg:table-cell">
          {t.description ?? "—"}
        </TableCell>
        <TableCell className="tabular-nums text-muted-foreground">{t.items.length}</TableCell>
        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-end gap-1">
            <PmChecklistItemDialog templateId={t.id} />
            <PmChecklistTemplateDialog template={t} />
          </div>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/30 p-0">
            {t.items.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">
                No tasks yet — add the first one.
              </p>
            ) : (
              <ol className="divide-y">
                {t.items.map((it, i) => (
                  <li
                    key={it.id}
                    className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                  >
                    <span>
                      <span className="mr-2 text-xs text-muted-foreground tabular-nums">
                        {i + 1}.
                      </span>
                      {it.label}
                    </span>
                    <PmChecklistItemDialog templateId={t.id} item={it} />
                  </li>
                ))}
              </ol>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
