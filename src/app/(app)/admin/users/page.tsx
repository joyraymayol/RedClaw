import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronsUpDownIcon,
} from "lucide-react";

import { UserActionsDialog } from "@/components/admin/user-actions-dialog";
import { UserStatusBadge } from "@/components/admin/user-status-badge";
import {
  ColumnsToggle,
  PerPageSelect,
  UsersSearch,
} from "@/components/admin/users-table-controls";
import { SortButton, type SortField } from "@/components/ui/sort-button";
import {
  DEFAULT_PER_PAGE,
  parseHiddenColumns,
  PER_PAGE_OPTIONS,
  USER_TABLE_COLUMNS,
} from "@/lib/constants/users-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { requireRole } from "@/lib/auth";
import { canManageUser } from "@/lib/authz";
import { DEPARTMENT_LABELS, DEPARTMENTS, departmentLabel } from "@/lib/constants/org";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "User accounts",
};

const FILTERS: { key: string; label: string; where?: Prisma.UserWhereInput }[] =
  [
    { key: "all", label: "All" },
    {
      key: "pending",
      label: "Pending",
      where: { status: { in: ["PENDING_PROFILE", "PENDING_APPROVAL"] } },
    },
    { key: "active", label: "Active", where: { status: "ACTIVE" } },
    { key: "disabled", label: "Disabled", where: { status: "DISABLED" } },
  ];

type SortDir = "asc" | "desc";

const SORT_COLUMNS: Record<
  string,
  (dir: SortDir) => Prisma.UserOrderByWithRelationInput
> = {
  name: (dir) => ({ name: dir }),
  email: (dir) => ({ email: dir }),
  department: (dir) => ({ department: { sort: dir, nulls: "last" } }),
  position: (dir) => ({ position: { sort: dir, nulls: "last" } }),
  status: (dir) => ({ status: dir }),
  joined: (dir) => ({ createdAt: dir }),
};

const SORT_FIELDS: SortField[] = [
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "department", label: "Department" },
  { value: "position", label: "Position" },
  { value: "status", label: "Status" },
  { value: "joined", label: "Joined" },
];

type TableState = {
  filter: string;
  q: string;
  perPage: number;
  sort: string | null;
  dir: SortDir;
  hide: string | null;
};

/** Query string for the given state, omitting defaults. `page` resets
    unless explicitly carried over. */
function tableHref(state: TableState, page?: number) {
  const params = new URLSearchParams();
  if (state.filter !== "all") params.set("filter", state.filter);
  if (state.q) params.set("q", state.q);
  if (state.perPage !== DEFAULT_PER_PAGE)
    params.set("perPage", String(state.perPage));
  if (state.sort) {
    params.set("sort", state.sort);
    if (state.dir === "desc") params.set("dir", "desc");
  }
  if (state.hide) params.set("hide", state.hide);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/users?${query}` : "/admin/users";
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
  const Icon = !isSorted
    ? ChevronsUpDownIcon
    : state.dir === "asc"
      ? ArrowUpIcon
      : ArrowDownIcon;

  return (
    <TableHead
      className={className}
      aria-sort={
        isSorted
          ? state.dir === "asc"
            ? "ascending"
            : "descending"
          : undefined
      }
    >
      <Link
        href={tableHref({ ...state, sort: column, dir: nextDir })}
        className={cn(
          "-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 transition-colors hover:text-foreground",
          isSorted && "text-foreground"
        )}
      >
        {children}
        <Icon
          className={cn("size-3.5", !isSorted && "text-muted-foreground/60")}
        />
      </Link>
    </TableHead>
  );
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    q?: string;
    page?: string;
    perPage?: string;
    sort?: string;
    dir?: string;
    hide?: string;
  }>;
}) {
  const admin = await requireRole("ADMIN", "HEAD");
  const params = await searchParams;

  const filter = FILTERS.find((f) => f.key === params.filter) ?? FILTERS[0];
  const q = params.q?.trim() ?? "";
  const perPageParam = Number(params.perPage);
  const perPage = (PER_PAGE_OPTIONS as readonly number[]).includes(
    perPageParam
  )
    ? perPageParam
    : DEFAULT_PER_PAGE;
  const sort = params.sort && params.sort in SORT_COLUMNS ? params.sort : null;
  const dir: SortDir = params.dir === "desc" ? "desc" : "asc";
  const hide = params.hide ?? null;
  const state: TableState = { filter: filter.key, q, perPage, sort, dir, hide };
  const hiddenCols = parseHiddenColumns(hide);
  const visibleColCount =
    3 + USER_TABLE_COLUMNS.filter((c) => !hiddenCols.has(c.key)).length;

  // department is now an enum, so match by label/value rather than ILIKE.
  const matchedDepartments = q
    ? DEPARTMENTS.filter(
        (d) =>
          d.toLowerCase().includes(q.toLowerCase()) ||
          DEPARTMENT_LABELS[d].toLowerCase().includes(q.toLowerCase())
      )
    : [];

  const qWhere: Prisma.UserWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          ...(matchedDepartments.length > 0
            ? [{ department: { in: matchedDepartments } }]
            : []),
          { position: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const where: Prisma.UserWhereInput = { ...filter.where, ...qWhere };

  const [total, pendingCount, filterCounts] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.count({ where: { status: "PENDING_APPROVAL" } }),
    // Per-tab counts scoped by the current search but not by the tab's own
    // status filter, so switching tabs doesn't make the numbers jump around.
    Promise.all(FILTERS.map((f) => prisma.user.count({ where: { ...f.where, ...qWhere } }))),
  ]);
  const countByFilter = new Map(FILTERS.map((f, i) => [f.key, filterCounts[i]]));

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageParam = Math.floor(Number(params.page));
  const page = Math.min(Math.max(pageParam || 1, 1), totalPages);

  const users = await prisma.user.findMany({
    where,
    orderBy: [
      // Enum order puts the two pending states first.
      ...(sort
        ? [SORT_COLUMNS[sort](dir)]
        : [{ status: "asc" as const }, { createdAt: "desc" as const }]),
      // Stable tiebreaker so rows don't shuffle between pages.
      { id: "asc" },
    ],
    skip: (page - 1) * perPage,
    take: perPage,
  });

  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, total);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          User accounts
        </h1>
        <p className="text-sm text-muted-foreground">
          {pendingCount === 0
            ? "No accounts waiting for approval."
            : `${pendingCount} account${pendingCount === 1 ? "" : "s"} waiting for approval.`}{" "}
          Verify people by their email — names and departments are
          self-reported.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="hidden flex-wrap items-center gap-1 md:flex">
          {FILTERS.map((f) => {
            const active = f.key === filter.key;
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
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                    active ? "bg-background" : "bg-muted-foreground/10"
                  )}
                >
                  {countByFilter.get(f.key) ?? 0}
                </span>
              </Link>
            );
          })}
        </div>
        <div className="flex w-full items-center gap-2 md:hidden">
          <UsersSearch className="flex-1 sm:max-w-none" />
          <SortButton fields={SORT_FIELDS} defaultSort="" defaultDir="asc" />
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <SortButton fields={SORT_FIELDS} defaultSort="" defaultDir="asc" />
          <ColumnsToggle />
          <UsersSearch />
        </div>
      </div>

      {/* Mobile: pill-style filter chips, matching the Tickets page's
          mobile status tabs. */}
      <div className="-mx-4 flex items-center gap-1 overflow-x-auto px-4 md:hidden">
        {FILTERS.map((f) => {
          const active = f.key === filter.key;
          return (
            <Link
              key={f.key}
              href={tableHref({ ...state, filter: f.key })}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors",
                active ? "bg-primary/15 font-medium text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1 py-0.5 text-[10px] tabular-nums",
                  active ? "bg-primary/20" : "bg-background"
                )}
              >
                {countByFilter.get(f.key) ?? 0}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        {/* Below `lg`, rows collapse to a card-per-row layout: the Name
            cell absorbs email/status/department/position as stacked
            details, and only Name + Actions remain real columns — there
            isn't room for separate columns without the sticky Actions
            column overlapping them. Regular columns reappear at `lg`,
            regardless of the Columns toggle. Full details and all
            actions also live in the per-row dialog. Actions stays
            pinned to the right edge so it never scrolls out of view. */}
        <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
          <TableHeader>
            <TableRow>
              <SortableHead column="name" state={state}>
                Name
              </SortableHead>
              {!hiddenCols.has("email") && (
                <SortableHead
                  column="email"
                  state={state}
                  className="hidden lg:table-cell"
                >
                  Email
                </SortableHead>
              )}
              {!hiddenCols.has("department") && (
                <SortableHead
                  column="department"
                  state={state}
                  className="hidden lg:table-cell"
                >
                  Department
                </SortableHead>
              )}
              {!hiddenCols.has("position") && (
                <SortableHead
                  column="position"
                  state={state}
                  className="hidden lg:table-cell"
                >
                  Position
                </SortableHead>
              )}
              <SortableHead
                column="status"
                state={state}
                className="hidden lg:table-cell"
              >
                Status
              </SortableHead>
              {!hiddenCols.has("joined") && (
                <SortableHead
                  column="joined"
                  state={state}
                  className="hidden lg:table-cell"
                >
                  Joined
                </SortableHead>
              )}
              <TableHead className="sticky right-0 border-l bg-background">
                <div className="w-20 text-center">Actions</div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={visibleColCount}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {q
                    ? `No accounts match "${q}".`
                    : "No accounts match this filter."}
                </TableCell>
              </TableRow>
            )}
            {users.map((u) => (
              <TableRow key={u.id} className="group">
                <TableCell className="align-top lg:align-middle">
                  <div className="font-medium">{u.name}</div>
                  <div className="mt-1 space-y-1.5 lg:hidden">
                    <div className="font-mono text-xs text-muted-foreground">
                      {u.email}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <UserStatusBadge status={u.status} />
                      {u.role && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {u.role}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {departmentLabel(u.department)}
                      {u.position && ` · ${u.position}`}
                    </div>
                  </div>
                </TableCell>
                {!hiddenCols.has("email") && (
                  <TableCell className="hidden font-mono text-xs lg:table-cell">
                    {u.email}
                  </TableCell>
                )}
                {!hiddenCols.has("department") && (
                  <TableCell className="hidden lg:table-cell">
                    {departmentLabel(u.department)}
                  </TableCell>
                )}
                {!hiddenCols.has("position") && (
                  <TableCell className="hidden lg:table-cell">
                    {u.position ?? "—"}
                  </TableCell>
                )}
                <TableCell className="hidden lg:table-cell">
                  <UserStatusBadge status={u.status} />
                  {u.role && (
                    <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                      {u.role}
                    </span>
                  )}
                </TableCell>
                {!hiddenCols.has("joined") && (
                  <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                    {formatDateTime(u.createdAt)}
                  </TableCell>
                )}
                <TableCell className="sticky right-0 border-l bg-background align-top group-hover:bg-muted lg:align-middle">
                  <div className="flex w-20 justify-center">
                    <UserActionsDialog
                      user={u}
                      isSelf={u.id === admin.id}
                      canManage={canManageUser(admin, u)}
                      isViewerAdmin={admin.role === "ADMIN"}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? "0 accounts"
            : `Showing ${rangeStart}–${rangeEnd} of ${total} account${total === 1 ? "" : "s"}`}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <PerPageSelect />
          <div className="flex items-center gap-1 text-sm">
            {page > 1 ? (
              <Link
                href={tableHref(state, page - 1)}
                className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                Previous
              </Link>
            ) : (
              <span className="px-2.5 py-1.5 text-muted-foreground/40">
                Previous
              </span>
            )}
            <span className="px-1 text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={tableHref(state, page + 1)}
                className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                Next
              </Link>
            ) : (
              <span className="px-2.5 py-1.5 text-muted-foreground/40">
                Next
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
