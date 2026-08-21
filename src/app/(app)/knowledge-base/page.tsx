import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronsUpDownIcon,
} from "lucide-react";

import { ProblemTypeFormDialog } from "@/components/knowledge-base/problem-type-form-dialog";
import { ProblemTypeTableRow } from "@/components/knowledge-base/problem-type-table-row";
import { SolutionFormDialog } from "@/components/knowledge-base/solution-form-dialog";
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
import { requireActiveUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Knowledge base" };

type View = "card" | "table";
type SortDir = "asc" | "desc";

const SORT_COLUMNS: Record<
  string,
  (dir: SortDir) => Prisma.ProblemTypeOrderByWithRelationInput
> = {
  name: (dir) => ({ name: dir }),
  category: (dir) => ({ category: { sort: dir, nulls: "last" } }),
  solutions: (dir) => ({ solutions: { _count: dir } }),
};

const DEFAULT_SORT = "name";
const DEFAULT_DIR: SortDir = "asc";

const SORT_FIELDS: SortField[] = [
  { value: "name", label: "Name" },
  { value: "category", label: "Category" },
  { value: "solutions", label: "Solutions" },
];

type PageState = {
  q: string;
  perPage: number;
  view: View;
  sort: string;
  dir: SortDir;
};

function kbHref(state: PageState, page?: number) {
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
  return query ? `/knowledge-base?${query}` : "/knowledge-base";
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
        href={kbHref({ ...state, sort: column, dir: nextDir })}
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

export default async function KnowledgeBasePage({
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
  const user = await requireActiveUser();
  const canManage = user.role === "ADMIN" || user.role === "HEAD";
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

  const where: Prisma.ProblemTypeWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { category: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          {
            solutions: {
              some: {
                OR: [
                  { title: { contains: q, mode: "insensitive" } },
                  { description: { contains: q, mode: "insensitive" } },
                  { asset: { assetCode: { contains: q, mode: "insensitive" } } },
                  { asset: { name: { contains: q, mode: "insensitive" } } },
                ],
              },
            },
          },
        ],
      }
    : {};

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      orderBy: { assetCode: "asc" },
      select: { id: true, assetCode: true, name: true },
    }),
    prisma.problemType.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageNumberParam = Math.floor(Number(params.page));
  const page = Math.min(Math.max(pageNumberParam || 1, 1), totalPages);

  const problemTypes = await prisma.problemType.findMany({
    where,
    orderBy: [SORT_COLUMNS[sort](dir), { id: "asc" }],
    skip: (page - 1) * perPage,
    take: perPage,
    include: {
      solutions: {
        orderBy: { createdAt: "desc" },
        include: { asset: { select: { assetCode: true, name: true } } },
      },
    },
  });

  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, total);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Knowledge base
          </h1>
          <p className="text-sm text-muted-foreground">
            Problem types and the curated fixes technicians and requesters
            see for them.
          </p>
        </div>
        {canManage && <ProblemTypeFormDialog />}
      </div>

      {/* Mobile: search+sort share a row; view toggle gets its own row,
          right-aligned, below. Sort works in both card and table view. */}
      <div className="flex flex-col gap-2 md:hidden">
        <div className="flex items-center gap-2">
          <DebouncedSearchInput
            placeholder="Search problem types, solutions, assets…"
            ariaLabel="Search knowledge base"
            resetParams={["page"]}
            className="flex-1 sm:max-w-none"
          />
          <SortButton
            fields={SORT_FIELDS}
            defaultSort={DEFAULT_SORT}
            defaultDir={DEFAULT_DIR}
          />
        </div>
        <div className="flex justify-end">
          <ViewToggle
            view={view}
            cardHref={kbHref({ ...state, view: "card" })}
            tableHref={kbHref({ ...state, view: "table" })}
          />
        </div>
      </div>

      <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
        <DebouncedSearchInput
          placeholder="Search problem types, solutions, assets…"
          ariaLabel="Search knowledge base"
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
            cardHref={kbHref({ ...state, view: "card" })}
            tableHref={kbHref({ ...state, view: "table" })}
          />
        </div>
      </div>

      {problemTypes.length === 0 && (
        <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
          {q ? `No problem types match "${q}".` : "No problem types yet."}
        </p>
      )}

      {problemTypes.length > 0 && view === "card" && (
        <div className="space-y-4">
          {problemTypes.map((pt) => (
            <div key={pt.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium">{pt.name}</h2>
                    {pt.category && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {pt.category}
                      </span>
                    )}
                  </div>
                  {pt.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {pt.description}
                    </p>
                  )}
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <SolutionFormDialog problemTypeId={pt.id} assets={assets} />
                    <ProblemTypeFormDialog problemType={pt} />
                  </div>
                )}
              </div>

              {pt.solutions.length > 0 && (
                <ul className="mt-3 space-y-2 border-t pt-3">
                  {pt.solutions.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-start justify-between gap-3 rounded-md bg-muted/30 p-2.5"
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
            </div>
          ))}
        </div>
      )}

      {problemTypes.length > 0 && view === "table" && (
        <div className="overflow-x-auto rounded-lg border">
          <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <SortableHead column="name" state={state}>
                  Name
                </SortableHead>
                <SortableHead column="category" state={state} className="hidden md:table-cell">
                  Category
                </SortableHead>
                <SortableHead column="solutions" state={state}>
                  Solutions
                </SortableHead>
                <TableHead className="hidden lg:table-cell">Description</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {problemTypes.map((pt) => (
                <ProblemTypeTableRow
                  key={pt.id}
                  problemType={pt}
                  assets={assets}
                  canManage={canManage}
                />
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
          itemLabel="problem type"
          hrefFor={(p) => kbHref(state, p)}
          perPageSelect={
            <PerPageSelect options={PER_PAGE_OPTIONS} defaultValue={DEFAULT_PER_PAGE} />
          }
        />
      )}
    </div>
  );
}
