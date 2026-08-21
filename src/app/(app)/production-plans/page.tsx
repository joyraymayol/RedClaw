import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronsUpDownIcon,
  PlusIcon,
  UsersIcon,
} from "lucide-react";

import { ProductionPlanListCard } from "@/components/production-plans/production-plan-list-card";
import { ProductionPlanStatusBadge } from "@/components/production-plans/production-plan-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DebouncedSearchInput } from "@/components/ui/debounced-search-input";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { PerPageSelect } from "@/components/ui/per-page-select";
import { SortButton, type SortField } from "@/components/ui/sort-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from "@/lib/constants/pagination";
import { requireActiveUser } from "@/lib/auth";
import { canPreparePlan } from "@/lib/authz";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Production plans" };

type SortDir = "asc" | "desc";

const SORT_COLUMNS: Record<
  string,
  (dir: SortDir) => Prisma.ProductionPlanOrderByWithRelationInput
> = {
  formNumber: (dir) => ({ formNumber: dir }),
  schedule: (dir) => ({ scheduleFrom: dir }),
  effective: (dir) => ({ effectiveDate: dir }),
  machines: (dir) => ({ rows: { _count: dir } }),
  status: (dir) => ({ status: dir }),
  preparedBy: (dir) => ({ preparedBy: { name: dir } }),
};

const SORT_FIELDS: SortField[] = [
  { value: "formNumber", label: "Form no." },
  { value: "schedule", label: "Schedule" },
  { value: "effective", label: "Effective date" },
  { value: "machines", label: "Machines" },
  { value: "status", label: "Status" },
  { value: "preparedBy", label: "Prepared by" },
];

type TableState = {
  q: string;
  perPage: number;
  sort: string | null;
  dir: SortDir;
};

function href(state: TableState, page?: number) {
  const search = new URLSearchParams();
  if (state.q) search.set("q", state.q);
  if (state.perPage !== DEFAULT_PER_PAGE) search.set("perPage", String(state.perPage));
  if (state.sort) {
    search.set("sort", state.sort);
    if (state.dir === "desc") search.set("dir", "desc");
  }
  if (page && page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `/production-plans?${query}` : "/production-plans";
}

function SortableHead({
  column,
  state,
  className,
  children,
}: {
  column: string;
  state: TableState;
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

export default async function ProductionPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; perPage?: string; sort?: string; dir?: string }>;
}) {
  const user = await requireActiveUser();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const perPageParam = Number(params.perPage);
  const perPage = (PER_PAGE_OPTIONS as readonly number[]).includes(perPageParam)
    ? perPageParam
    : DEFAULT_PER_PAGE;
  const sort = params.sort && params.sort in SORT_COLUMNS ? params.sort : null;
  const dir: SortDir = params.dir === "desc" ? "desc" : "asc";
  const state: TableState = { q, perPage, sort, dir };

  const canPrepare = canPreparePlan(user);
  const canManageApprovers = user.role === "ADMIN" || user.role === "HEAD";
  const isApprover = !!(await prisma.productionPlanApprover.findUnique({
    where: { userId: user.id },
    select: { userId: true },
  }));

  // Preparers (Production/ADMIN) and HEAD see every plan; designated approvers
  // additionally see pending ones; everyone else sees only approved plans.
  const seesAll = canPrepare || user.role === "HEAD";
  const statusScope: Prisma.ProductionPlanWhereInput = seesAll
    ? {}
    : isApprover
      ? { status: { in: ["PENDING_APPROVAL", "APPROVED"] } }
      : { status: "APPROVED" };

  const where: Prisma.ProductionPlanWhereInput = {
    ...statusScope,
    ...(q && { formNumber: { contains: q, mode: "insensitive" } }),
  };

  const total = await prisma.productionPlan.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(Math.floor(Number(params.page)) || 1, 1), totalPages);

  const plans = await prisma.productionPlan.findMany({
    where,
    orderBy: [
      ...(sort ? [SORT_COLUMNS[sort](dir)] : [{ createdAt: "desc" as const }]),
      { id: "asc" },
    ],
    skip: (page - 1) * perPage,
    take: perPage,
    select: {
      id: true,
      formNumber: true,
      scheduleFrom: true,
      scheduleTo: true,
      effectiveDate: true,
      status: true,
      preparedBy: { select: { name: true } },
      _count: { select: { rows: true } },
    },
  });

  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, total);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Production plans</h1>
          <p className="text-sm text-muted-foreground">
            Weekly machine schedules prepared by Production and approved for
            Maintenance to action.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManageApprovers && (
            <Button
              variant="outline"
              render={<Link href="/production-plans/approvers" />}
              nativeButton={false}
            >
              <UsersIcon className="size-4" />
              Approvers
            </Button>
          )}
          {canPrepare && (
            <Button render={<Link href="/production-plans/new" />} nativeButton={false}>
              <PlusIcon className="size-4" />
              Prepare a plan
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 md:hidden">
        <DebouncedSearchInput
          placeholder="Search form number…"
          ariaLabel="Search production plans"
          resetParams={["page"]}
          className="flex-1 sm:max-w-none"
        />
        <SortButton fields={SORT_FIELDS} defaultSort="" defaultDir="asc" />
      </div>
      <div className="hidden flex-wrap items-center justify-between gap-3 md:flex">
        <DebouncedSearchInput
          placeholder="Search form number…"
          ariaLabel="Search production plans"
          resetParams={["page"]}
          className="sm:max-w-sm"
        />
        <SortButton fields={SORT_FIELDS} defaultSort="" defaultDir="asc" />
      </div>

      {/* Mobile: card list */}
      <div className="space-y-3 md:hidden">
        {plans.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {q ? `No plans match "${q}".` : "No production plans yet."}
          </p>
        )}
        {plans.map((p) => (
          <ProductionPlanListCard key={p.id} plan={p} />
        ))}
      </div>

      {/* Desktop: unchanged table */}
      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-lg border">
          <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
            <TableHeader>
              <TableRow>
                <SortableHead column="formNumber" state={state}>
                  Form no.
                </SortableHead>
                <SortableHead column="schedule" state={state} className="hidden md:table-cell">
                  Schedule
                </SortableHead>
                <SortableHead column="effective" state={state} className="hidden lg:table-cell">
                  Effective
                </SortableHead>
                <SortableHead column="machines" state={state}>
                  Machines
                </SortableHead>
                <SortableHead column="status" state={state}>
                  Status
                </SortableHead>
                <SortableHead column="preparedBy" state={state} className="hidden lg:table-cell">
                  Prepared by
                </SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    {q ? `No plans match "${q}".` : "No production plans yet."}
                  </TableCell>
                </TableRow>
              )}
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      href={`/production-plans/${p.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "xs" }), "font-mono")}
                    >
                      {p.formNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {formatDate(p.scheduleFrom)} – {formatDate(p.scheduleTo)}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {formatDate(p.effectiveDate)}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {p._count.rows}
                  </TableCell>
                  <TableCell>
                    <ProductionPlanStatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {p.preparedBy.name}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <PaginationBar
        total={total}
        page={page}
        totalPages={totalPages}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        itemLabel="plan"
        hrefFor={(p) => href(state, p)}
        perPageSelect={
          <PerPageSelect options={PER_PAGE_OPTIONS} defaultValue={DEFAULT_PER_PAGE} />
        }
      />
    </div>
  );
}
