import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronsUpDownIcon,
  PlusIcon,
} from "lucide-react";

import { TableSkeleton } from "@/components/skeletons/table-skeleton";
import { TicketPriorityBadge } from "@/components/tickets/ticket-priority-badge";
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import { TICKET_TYPE_LABELS, TicketTypeBadge } from "@/components/tickets/ticket-type-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { DebouncedSearchInput } from "@/components/ui/debounced-search-input";
import { ListNavPending, ListNavProvider } from "@/components/ui/list-nav-context";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { PerPageSelect } from "@/components/ui/per-page-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DEFAULT_PER_PAGE,
  PER_PAGE_OPTIONS,
} from "@/lib/constants/tickets-table";
import type { Prisma, TicketStatus, TicketType } from "@/generated/prisma/client";
import { requireActiveUser } from "@/lib/auth";
import { createdAtRange, parseDayParam } from "@/lib/date-range";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tickets" };

const OPEN_STATUSES: TicketStatus[] = ["OPEN", "ASSIGNED"];
const ACTIVE_STATUSES: TicketStatus[] = ["IN_PROGRESS", "ON_HOLD"];
const ATTENTION_STATUSES: TicketStatus[] = [
  "PENDING_VERIFICATION",
  "PENDING_SUPERVISOR_REVIEW",
  "REOPENED",
];
const DONE_STATUSES: TicketStatus[] = ["CLOSED", "CANCELLED"];

const FILTERS: {
  key: string;
  label: string;
  where?: Prisma.TicketWhereInput;
  countStatuses?: TicketStatus[];
}[] = [
  { key: "all", label: "All" },
  {
    key: "open",
    label: "Open",
    where: { status: { in: OPEN_STATUSES } },
    countStatuses: OPEN_STATUSES,
  },
  {
    key: "active",
    label: "Active",
    where: { status: { in: ACTIVE_STATUSES } },
    countStatuses: ACTIVE_STATUSES,
  },
  {
    key: "attention",
    label: "Needs attention",
    where: { status: { in: ATTENTION_STATUSES } },
    countStatuses: ATTENTION_STATUSES,
  },
  { key: "done", label: "Closed", where: { status: { in: DONE_STATUSES } } },
];

type SortDir = "asc" | "desc";

const SORT_COLUMNS: Record<string, (dir: SortDir) => Prisma.TicketOrderByWithRelationInput> = {
  ticketNumber: (dir) => ({ ticketNumber: dir }),
  priority: (dir) => ({ priority: dir }),
  status: (dir) => ({ status: dir }),
  created: (dir) => ({ createdAt: dir }),
};

// Tickets default to newest-raised-first — a bare "sort"-less URL still
// carries an explicit column/direction internally so the "Raised" header
// renders as actively sorted instead of looking unsorted.
const DEFAULT_SORT = "created";
const DEFAULT_DIR: SortDir = "desc";

const TICKET_TYPES = Object.keys(TICKET_TYPE_LABELS) as TicketType[];

type TableState = {
  filter: string;
  category: string;
  type: string;
  q: string;
  from: string;
  to: string;
  perPage: number;
  sort: string;
  dir: SortDir;
};

function tableHref(state: TableState, page?: number) {
  const params = new URLSearchParams();
  if (state.filter !== "all") params.set("filter", state.filter);
  if (state.category) params.set("category", state.category);
  if (state.type) params.set("type", state.type);
  if (state.q) params.set("q", state.q);
  if (state.from) params.set("from", state.from);
  if (state.to) params.set("to", state.to);
  if (state.perPage !== DEFAULT_PER_PAGE) params.set("perPage", String(state.perPage));
  if (state.sort !== DEFAULT_SORT || state.dir !== DEFAULT_DIR) {
    params.set("sort", state.sort);
    if (state.dir === "desc") params.set("dir", "desc");
  }
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/tickets?${query}` : "/tickets";
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
        href={tableHref({ ...state, sort: column, dir: nextDir })}
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

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    category?: string;
    type?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: string;
    perPage?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const user = await requireActiveUser();
  const params = await searchParams;

  const filter = FILTERS.find((f) => f.key === params.filter) ?? FILTERS[0];
  const category = params.category?.trim() ?? "";
  const type =
    params.type && (TICKET_TYPES as string[]).includes(params.type) ? params.type : "";
  const q = params.q?.trim() ?? "";
  const fromDate = parseDayParam(params.from);
  const toDate = parseDayParam(params.to);
  const from = fromDate ? params.from!.trim() : "";
  const to = toDate ? params.to!.trim() : "";
  const perPageParam = Number(params.perPage);
  const perPage = (PER_PAGE_OPTIONS as readonly number[]).includes(perPageParam)
    ? perPageParam
    : DEFAULT_PER_PAGE;
  const sortParam = params.sort && params.sort in SORT_COLUMNS ? params.sort : null;
  const sort = sortParam ?? DEFAULT_SORT;
  const dir: SortDir = sortParam ? (params.dir === "desc" ? "desc" : "asc") : DEFAULT_DIR;
  const state: TableState = { filter: filter.key, category, type, q, from, to, perPage, sort, dir };

  const categories = await prisma.assetCategory.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  // Requesters see their own tickets; technicians see what's assigned to
  // them; admins/supervisors/head see everything (plan §1 — the page just
  // narrows what's visible, `can()` is still the real gate on every action).
  const scope: Prisma.TicketWhereInput =
    user.role === "REQUESTER"
      ? { requesterId: user.id }
      : user.role === "TECHNICIAN"
        ? { assignments: { some: { technicianId: user.id, unassignedAt: null } } }
        : {};

  const createdAt = createdAtRange(fromDate, toDate);

  const scopedWhere: Prisma.TicketWhereInput = {
    ...scope,
    ...(createdAt && { createdAt }),
    ...(type && { type: type as TicketType }),
    ...(category && { assets: { some: { unflaggedAt: null, asset: { categoryId: category } } } }),
    ...(q && {
      OR: [
        { ticketNumber: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        {
          assets: {
            some: {
              unflaggedAt: null,
              asset: {
                OR: [
                  { assetCode: { contains: q, mode: "insensitive" } },
                  { name: { contains: q, mode: "insensitive" } },
                ],
              },
            },
          },
        },
      ],
    }),
  };

  const where: Prisma.TicketWhereInput = { ...scopedWhere, ...filter.where };

  const total = await prisma.ticket.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageParam = Math.floor(Number(params.page));
  const page = Math.min(Math.max(pageParam || 1, 1), totalPages);

  const [tickets, statusCounts] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: [
        SORT_COLUMNS[sort](dir),
        { id: "asc" },
      ],
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        assets: {
          where: { unflaggedAt: null },
          orderBy: { flaggedAt: "asc" },
          select: { asset: { select: { assetCode: true } } },
        },
        assignments: {
          where: { unassignedAt: null },
          orderBy: { assignedAt: "asc" },
          select: { technician: { select: { name: true } } },
        },
      },
    }),
    prisma.ticket.groupBy({ by: ["status"], where: scopedWhere, _count: { _all: true } }),
  ]);

  const countByStatus = new Map(statusCounts.map((s) => [s.status, s._count._all]));
  const sumStatuses = (statuses: TicketStatus[]) =>
    statuses.reduce((sum, s) => sum + (countByStatus.get(s) ?? 0), 0);

  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, total);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
          <p className="text-sm text-muted-foreground">
            {user.role === "REQUESTER"
              ? "Tickets you've raised."
              : user.role === "TECHNICIAN"
                ? "Tickets assigned to you."
                : "All maintenance tickets."}
          </p>
        </div>
        <Button render={<Link href="/tickets/new" />} nativeButton={false}>
          <PlusIcon className="size-4" />
          Raise a ticket
        </Button>
      </div>

      <ListNavProvider className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1">
            {FILTERS.map((f) => {
              const active = f.key === filter.key;
              const count = f.countStatuses ? sumStatuses(f.countStatuses) : undefined;
              return (
                <Link
                  key={f.key}
                  href={tableHref({ ...state, filter: f.key })}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f.label}
                  {count !== undefined && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                        active ? "bg-background" : "bg-muted-foreground/10"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <DateRangeFilter label="Raised date" resetParams={["page"]} />
            <DebouncedSearchInput
              placeholder="Search ticket #, title, asset…"
              ariaLabel="Search tickets"
              resetParams={["page"]}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <Link
            href={tableHref({ ...state, category: "" })}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm transition-colors",
              !category
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All categories
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={tableHref({ ...state, category: c.id })}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-sm transition-colors",
                category === c.id
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {c.name}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <Link
            href={tableHref({ ...state, type: "" })}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm transition-colors",
              !type
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All types
          </Link>
          {TICKET_TYPES.map((t) => (
            <Link
              key={t}
              href={tableHref({ ...state, type: t })}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-sm transition-colors",
                type === t
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {TICKET_TYPE_LABELS[t]}
            </Link>
          ))}
        </div>

        <ListNavPending
          fallback={
            <div className="space-y-6">
              <TableSkeleton columns={7} rows={Math.min(perPage, 8)} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-8 w-56" />
              </div>
            </div>
          }
        >
          <div className="space-y-6">
            <div className="overflow-x-auto rounded-lg border">
              <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
                <TableHeader>
                  <TableRow>
                    <SortableHead column="ticketNumber" state={state}>
                      Ticket
                    </SortableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="hidden md:table-cell">Asset</TableHead>
                    <TableHead className="hidden lg:table-cell">Technician</TableHead>
                    <SortableHead column="priority" state={state}>
                      Priority
                    </SortableHead>
                    <SortableHead column="status" state={state}>
                      Status
                    </SortableHead>
                    <SortableHead column="created" state={state} className="hidden md:table-cell">
                      Raised
                    </SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        {q ? `No tickets match "${q}".` : "No tickets match this filter."}
                      </TableCell>
                    </TableRow>
                  )}
                  {tickets.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Link
                          href={`/tickets/${t.id}`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "xs" }),
                            "font-mono"
                          )}
                        >
                          {t.ticketNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-64">
                        <span className="block truncate">{t.title}</span>
                        {t.type !== "MAINTENANCE" && (
                          <span className="mt-1 inline-block">
                            <TicketTypeBadge type={t.type} />
                          </span>
                        )}
                      </TableCell>
                      <TableCell
                        className="hidden text-muted-foreground md:table-cell"
                        title={t.assets.map((a) => a.asset.assetCode).join(", ") || undefined}
                      >
                        {t.assets.length === 0
                          ? "—"
                          : t.assets.length === 1
                            ? t.assets[0].asset.assetCode
                            : `${t.assets[0].asset.assetCode} +${t.assets.length - 1}`}
                      </TableCell>
                      <TableCell
                        className="hidden text-muted-foreground lg:table-cell"
                        title={t.assignments.map((a) => a.technician.name).join(", ") || undefined}
                      >
                        {t.assignments.length === 0
                          ? "—"
                          : t.assignments.length === 1
                            ? t.assignments[0].technician.name
                            : `${t.assignments[0].technician.name} +${t.assignments.length - 1}`}
                      </TableCell>
                      <TableCell>
                        <TicketPriorityBadge priority={t.priority} />
                      </TableCell>
                      <TableCell>
                        <TicketStatusBadge status={t.status} />
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                        {formatDateTime(t.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <PaginationBar
              total={total}
              page={page}
              totalPages={totalPages}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              itemLabel="ticket"
              hrefFor={(p) => tableHref(state, p)}
              perPageSelect={
                <PerPageSelect options={PER_PAGE_OPTIONS} defaultValue={DEFAULT_PER_PAGE} />
              }
            />
          </div>
        </ListNavPending>
      </ListNavProvider>
    </div>
  );
}
