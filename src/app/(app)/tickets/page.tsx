import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";

import { TableSkeleton } from "@/components/skeletons/table-skeleton";
import { TicketFilterBar } from "@/components/tickets/ticket-filter-bar";
import { TicketFilterSheet } from "@/components/tickets/ticket-filter-sheet";
import { TicketListCard } from "@/components/tickets/ticket-list-card";
import { TICKET_PRIORITY_LABELS, TicketPriorityBadge } from "@/components/tickets/ticket-priority-badge";
import { TicketSortSelect } from "@/components/tickets/ticket-sort-select";
import { TICKET_STATUS_LABELS, TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
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
import type { Prisma, TicketPriority, TicketStatus, TicketType } from "@/generated/prisma/client";
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
  /** Display label for the mobile quick-tab row, when it differs from `label`. */
  mobileLabel?: string;
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
    mobileLabel: "In progress",
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

// The mobile quick-tab row is a 4-way subset of FILTERS (All/Open/In
// progress/Closed) — "Needs attention" is still reachable via the Status
// filter in the sheet, just not pinned as its own tab on small screens.
const MOBILE_FILTERS = FILTERS.filter((f) => f.key !== "attention");

const TICKET_PRIORITIES = Object.keys(TICKET_PRIORITY_LABELS) as TicketPriority[];
const TICKET_STATUSES = Object.keys(TICKET_STATUS_LABELS) as TicketStatus[];

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
  asset: string;
  type: string;
  priority: string;
  status: string;
  technician: string;
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
  if (state.asset) params.set("asset", state.asset);
  if (state.type) params.set("type", state.type);
  if (state.priority) params.set("priority", state.priority);
  if (state.status) params.set("status", state.status);
  if (state.technician) params.set("technician", state.technician);
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

/** Removable "Category: Machines ×" style chip used on the mobile active-filters row. */
function FilterChip({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted-foreground/15"
    >
      {label}
      <XIcon className="size-3" />
    </Link>
  );
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    category?: string;
    asset?: string;
    type?: string;
    priority?: string;
    status?: string;
    technician?: string;
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
  const asset = params.asset?.trim() ?? "";
  const type =
    params.type && (TICKET_TYPES as string[]).includes(params.type) ? params.type : "";
  const priority =
    params.priority && (TICKET_PRIORITIES as string[]).includes(params.priority)
      ? (params.priority as TicketPriority)
      : "";
  const statuses = (params.status?.split(",") ?? [])
    .map((s) => s.trim())
    .filter((s): s is TicketStatus => (TICKET_STATUSES as string[]).includes(s));
  const technician = params.technician?.trim() ?? "";
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
  const state: TableState = {
    filter: filter.key,
    category,
    asset,
    type,
    priority,
    status: statuses.join(","),
    technician,
    q,
    from,
    to,
    perPage,
    sort,
    dir,
  };

  const [categories, assets, technicians] = await Promise.all([
    prisma.assetCategory.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.asset.findMany({
      orderBy: { assetCode: "asc" },
      select: { id: true, assetCode: true, name: true },
    }),
    prisma.user.findMany({
      where: { role: "TECHNICIAN", status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
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
    ...(priority && { priority: priority as TicketPriority }),
    ...(statuses.length > 0 && { status: { in: statuses } }),
    ...((category || asset) && {
      assets: {
        some: {
          unflaggedAt: null,
          asset: {
            ...(category && { categoryId: category }),
            ...(asset && { id: asset }),
          },
        },
      },
    }),
    ...(technician && {
      assignments: { some: { technicianId: technician, unassignedAt: null } },
    }),
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
          select: { asset: { select: { assetCode: true, name: true } } },
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
        {/* Mobile: search + filter sheet, active-filter chips, quick status
            tabs, sort — a purpose-built layout, not a shrunk desktop table. */}
        <div className="space-y-3 md:hidden">
          <div className="flex items-center gap-2">
            <DebouncedSearchInput
              placeholder="Search ticket #, title, asset…"
              ariaLabel="Search tickets"
              resetParams={["page"]}
              className="flex-1 sm:max-w-none"
            />
            <TicketFilterSheet
              categories={categories}
              current={{ category, type, priority, statuses, from, to }}
            />
          </div>

          {(category || type || priority || statuses.length > 0 || from || to) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {category && (
                <FilterChip
                  label={`Category: ${categories.find((c) => c.id === category)?.name ?? category}`}
                  href={tableHref({ ...state, category: "" })}
                />
              )}
              {type && (
                <FilterChip
                  label={`Type: ${TICKET_TYPE_LABELS[type as TicketType]}`}
                  href={tableHref({ ...state, type: "" })}
                />
              )}
              {priority && (
                <FilterChip
                  label={`Priority: ${TICKET_PRIORITY_LABELS[priority]}`}
                  href={tableHref({ ...state, priority: "" })}
                />
              )}
              {statuses.length > 0 && (
                <FilterChip
                  label={`Status: ${statuses.map((s) => TICKET_STATUS_LABELS[s]).join(", ")}`}
                  href={tableHref({ ...state, status: "" })}
                />
              )}
              {(from || to) && (
                <FilterChip
                  label={`Raised: ${fromDate ? format(fromDate, "MMM d") : "…"} – ${toDate ? format(toDate, "MMM d") : "…"}`}
                  href={tableHref({ ...state, from: "", to: "" })}
                />
              )}
            </div>
          )}

          <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4">
            {MOBILE_FILTERS.map((f) => {
              const active = f.key === filter.key;
              const count =
                f.key === "done"
                  ? sumStatuses(DONE_STATUSES)
                  : f.countStatuses
                    ? sumStatuses(f.countStatuses)
                    : undefined;
              return (
                <Link
                  key={f.key}
                  href={tableHref({ ...state, filter: f.key })}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
                    active ? "bg-primary/15 font-medium text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  {f.mobileLabel ?? f.label}
                  {count !== undefined && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                        active ? "bg-primary/20" : "bg-background"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {total} ticket{total === 1 ? "" : "s"}
            </p>
            <TicketSortSelect />
          </div>
        </div>

        {/* Desktop: status tabs + raised-date above a bordered filter panel
            (Category/Asset/Type/Priority/Status/Technician + search). */}
        <div className="hidden space-y-4 md:block">
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
            <DateRangeFilter label="Raised date" resetParams={["page"]} />
          </div>

          <TicketFilterBar
            categories={categories}
            assets={assets}
            technicians={technicians}
            current={{ category, asset, type, priority, status: state.status, technician }}
          />
        </div>

        <ListNavPending
          fallback={
            <div className="space-y-6">
              <div className="hidden md:block">
                <div className="space-y-6">
                  <TableSkeleton columns={7} rows={Math.min(perPage, 8)} />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-8 w-56" />
                  </div>
                </div>
              </div>
              <div className="space-y-3 md:hidden">
                {Array.from({ length: Math.min(perPage, 6) }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-lg" />
                ))}
              </div>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Mobile: card list */}
            <div className="space-y-3 md:hidden">
              {tickets.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {q ? `No tickets match "${q}".` : "No tickets match this filter."}
                </p>
              )}
              {tickets.map((t) => (
                <TicketListCard key={t.id} ticket={t} />
              ))}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-1 text-sm">
                  {page > 1 ? (
                    <Link
                      href={tableHref(state, page - 1)}
                      aria-label="Previous page"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ChevronLeftIcon className="size-4" />
                    </Link>
                  ) : (
                    <ChevronLeftIcon className="size-4 text-muted-foreground/30" />
                  )}
                  <span className="text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  {page < totalPages ? (
                    <Link
                      href={tableHref(state, page + 1)}
                      aria-label="Next page"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ChevronRightIcon className="size-4" />
                    </Link>
                  ) : (
                    <ChevronRightIcon className="size-4 text-muted-foreground/30" />
                  )}
                </div>
              )}
            </div>

            {/* Desktop: unchanged table + pagination bar */}
            <div className="hidden space-y-6 md:block">
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
          </div>
        </ListNavPending>
      </ListNavProvider>
    </div>
  );
}
