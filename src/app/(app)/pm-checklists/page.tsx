import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronsUpDownIcon,
} from "lucide-react";

import { PmChecklistItemDialog } from "@/components/pm-checklists/pm-checklist-item-dialog";
import { PmChecklistTemplateDialog } from "@/components/pm-checklists/pm-checklist-template-dialog";
import { PmChecklistTemplateTableRow } from "@/components/pm-checklists/pm-checklist-template-table-row";
import { DebouncedSearchInput } from "@/components/ui/debounced-search-input";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { PerPageSelect } from "@/components/ui/per-page-select";
import { SortButton, type SortField } from "@/components/ui/sort-button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ViewToggle } from "@/components/ui/view-toggle";
import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from "@/lib/constants/pagination";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "PM checklists" };

type View = "card" | "table";
type SortDir = "asc" | "desc";

const SORT_COLUMNS: Record<
  string,
  (dir: SortDir) => Prisma.PmChecklistTemplateOrderByWithRelationInput
> = {
  name: (dir) => ({ name: dir }),
  tasks: (dir) => ({ items: { _count: dir } }),
};

const DEFAULT_SORT = "name";
const DEFAULT_DIR: SortDir = "asc";

const SORT_FIELDS: SortField[] = [
  { value: "name", label: "Name" },
  { value: "tasks", label: "Tasks" },
];

type PageState = {
  q: string;
  perPage: number;
  view: View;
  sort: string;
  dir: SortDir;
};

function href(state: PageState, page?: number) {
  const search = new URLSearchParams();
  if (state.q) search.set("q", state.q);
  if (state.perPage !== DEFAULT_PER_PAGE) search.set("perPage", String(state.perPage));
  if (state.view !== "card") search.set("view", state.view);
  if (state.sort !== DEFAULT_SORT || state.dir !== DEFAULT_DIR) {
    search.set("sort", state.sort);
    if (state.dir === "desc") search.set("dir", "desc");
  }
  if (page && page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `/pm-checklists?${query}` : "/pm-checklists";
}

function SortableHead({
  column,
  state,
  className,
  children,
}: {
  column: string;
  state: PageState;
  className?: string;
  children: React.ReactNode;
}) {
  const isSorted = state.sort === column;
  const nextDir: SortDir = isSorted && state.dir === "asc" ? "desc" : "asc";
  const Icon = !isSorted ? ChevronsUpDownIcon : state.dir === "asc" ? ArrowUpIcon : ArrowDownIcon;

  return (
    <TableHead
      className={className}
      aria-sort={isSorted ? (state.dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <Link
        href={href({ ...state, sort: column, dir: nextDir })}
        className={cn(
          "-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 transition-colors hover:text-foreground",
          isSorted && "text-foreground"
        )}
      >
        {children}
        <Icon className={cn("size-3.5", !isSorted && "text-muted-foreground/60")} />
      </Link>
    </TableHead>
  );
}

export default async function PmChecklistsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    perPage?: string;
    view?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  // Maintenance Head/Supervisor prepare these (ADMIN too).
  await requireRole("ADMIN", "HEAD", "SUPERVISOR");
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const perPageParam = Number(params.perPage);
  const perPage = (PER_PAGE_OPTIONS as readonly number[]).includes(perPageParam)
    ? perPageParam
    : DEFAULT_PER_PAGE;
  const view: View = params.view === "table" ? "table" : "card";
  const sort = params.sort && params.sort in SORT_COLUMNS ? params.sort : DEFAULT_SORT;
  const dir: SortDir = params.dir === "desc" ? "desc" : "asc";
  const state: PageState = { q, perPage, view, sort, dir };

  const where: Prisma.PmChecklistTemplateWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { items: { some: { label: { contains: q, mode: "insensitive" } } } },
        ],
      }
    : {};

  const total = await prisma.pmChecklistTemplate.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(Math.floor(Number(params.page)) || 1, 1), totalPages);

  const templates = await prisma.pmChecklistTemplate.findMany({
    where,
    orderBy:
      view === "table" ? [SORT_COLUMNS[sort](dir), { id: "asc" }] : { name: "asc" },
    skip: (page - 1) * perPage,
    take: perPage,
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, total);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">PM checklists</h1>
          <p className="text-sm text-muted-foreground">
            Reusable preventive-maintenance task lists. Attach one to a machine
            as its default — it&apos;s snapshotted onto each new PM ticket.
          </p>
        </div>
        <PmChecklistTemplateDialog />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DebouncedSearchInput
          placeholder="Search checklists and tasks…"
          ariaLabel="Search PM checklists"
          resetParams={["page"]}
          className="sm:max-w-sm"
        />
        <div className="flex items-center gap-2">
          {view === "table" && (
            <SortButton
              fields={SORT_FIELDS}
              defaultSort={DEFAULT_SORT}
              defaultDir={DEFAULT_DIR}
            />
          )}
          <ViewToggle
            view={view}
            cardHref={href({ ...state, view: "card" })}
            tableHref={href({ ...state, view: "table" })}
          />
        </div>
      </div>

      {templates.length === 0 && (
        <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
          {q ? `No checklists match "${q}".` : "No checklists yet."}
        </p>
      )}

      {templates.length > 0 && view === "card" && (
        <div className="space-y-4">
          {templates.map((t) => (
            <div key={t.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{t.name}</h2>
                  {t.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <PmChecklistItemDialog templateId={t.id} />
                  <PmChecklistTemplateDialog template={t} />
                </div>
              </div>

              {t.items.length > 0 ? (
                <ol className="mt-3 space-y-1.5 border-t pt-3">
                  {t.items.map((it, i) => (
                    <li
                      key={it.id}
                      className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-2.5 py-1.5 text-sm"
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
              ) : (
                <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                  No tasks yet — add the first one.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {templates.length > 0 && view === "table" && (
        <div className="overflow-x-auto rounded-lg border">
          <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <SortableHead column="name" state={state}>
                  Name
                </SortableHead>
                <TableHead className="hidden lg:table-cell">Description</TableHead>
                <SortableHead column="tasks" state={state}>
                  Tasks
                </SortableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <PmChecklistTemplateTableRow key={t.id} template={t} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {total > 0 && (
        <PaginationBar
          total={total}
          page={page}
          totalPages={totalPages}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          itemLabel="checklist"
          hrefFor={(p) => href(state, p)}
          perPageSelect={
            <PerPageSelect options={PER_PAGE_OPTIONS} defaultValue={DEFAULT_PER_PAGE} />
          }
        />
      )}
    </div>
  );
}
