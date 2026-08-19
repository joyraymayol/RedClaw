"use client";

import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";

import { ProblemTypeFormDialog } from "@/components/knowledge-base/problem-type-form-dialog";
import { SolutionFormDialog } from "@/components/knowledge-base/solution-form-dialog";
import { TableCell, TableRow } from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";

type ProblemType = Prisma.ProblemTypeGetPayload<{
  include: {
    solutions: { include: { asset: { select: { assetCode: true; name: true } } } };
  };
}>;

/** Table-view row for a problem type — expands in place to the same
    solutions list Card view shows, instead of linking out to a detail page
    (there isn't one). */
export function ProblemTypeTableRow({
  problemType: pt,
  assets,
  canManage,
}: {
  problemType: ProblemType;
  assets: { id: string; assetCode: string; name: string }[];
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const colSpan = canManage ? 6 : 5;

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
        <TableCell className="font-medium">{pt.name}</TableCell>
        <TableCell className="hidden text-muted-foreground md:table-cell">
          {pt.category ?? "—"}
        </TableCell>
        <TableCell className="tabular-nums text-muted-foreground">
          {pt.solutions.length}
        </TableCell>
        <TableCell className="hidden max-w-xs truncate text-muted-foreground lg:table-cell">
          {pt.description ?? "—"}
        </TableCell>
        {canManage && (
          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end gap-1">
              <SolutionFormDialog problemTypeId={pt.id} assets={assets} />
              <ProblemTypeFormDialog problemType={pt} />
            </div>
          </TableCell>
        )}
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={colSpan} className="bg-muted/30 p-0">
            {pt.solutions.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">
                No solutions yet.
              </p>
            ) : (
              <ul className="divide-y">
                {pt.solutions.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-start justify-between gap-3 px-4 py-2.5"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {s.title}
                        {s.asset && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {s.asset.assetCode}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {s.description}
                      </p>
                    </div>
                    {canManage && (
                      <SolutionFormDialog
                        problemTypeId={pt.id}
                        assets={assets}
                        solution={s}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
