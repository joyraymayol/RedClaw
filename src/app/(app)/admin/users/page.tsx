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
  PerPageSelect,
  UsersSearch,
} from "@/components/admin/users-table-controls";
import {
  DEFAULT_PER_PAGE,
  PER_PAGE_OPTIONS,
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

type TableState = {
  filter: string;
  q: string;
  perPage: number;
  sort: string | null;
  dir: SortDir;
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
  const state: TableState = { filter: filter.key, q, perPage, sort, dir };

  const where: Prisma.UserWhereInput = {
    ...filter.where,
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { department: { contains: q, mode: "insensitive" } },
        { position: { contains: q, mode: "insensitive" } },
      ],
    }),
  };

  const [total, pendingCount] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.count({ where: { status: "PENDING_APPROVAL" } }),
  ]);

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
        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={tableHref({ ...state, filter: f.key })}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-sm transition-colors",
                f.key === filter.key
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <UsersSearch />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        {/* Narrow screens keep three columns (name+email, status, actions);
            the rest appear as the viewport widens. Full details and all
            actions live in the per-row dialog. */}
        <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
          <TableHeader>
            <TableRow>
              <SortableHead column="name" state={state}>
                Name
              </SortableHead>
              <SortableHead
                column="email"
                state={state}
                className="hidden md:table-cell"
              >
                Email
              </SortableHead>
              <SortableHead
                column="department"
                state={state}
                className="hidden lg:table-cell"
              >
                Department
              </SortableHead>
              <SortableHead
                column="position"
                state={state}
                className="hidden lg:table-cell"
              >
                Position
              </SortableHead>
              <SortableHead column="status" state={state}>
                Status
              </SortableHead>
              <SortableHead
                column="joined"
                state={state}
                className="hidden md:table-cell"
              >
                Joined
              </SortableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {q
                    ? `No accounts match "${q}".`
                    : "No accounts match this filter."}
                </TableCell>
              </TableRow>
            )}
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="font-medium">{u.name}</div>
                  <div className="font-mono text-xs text-muted-foreground md:hidden">
                    {u.email}
                  </div>
                </TableCell>
                <TableCell className="hidden font-mono text-xs md:table-cell">
                  {u.email}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {u.department ?? "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {u.position ?? "—"}
                </TableCell>
                <TableCell>
                  <UserStatusBadge status={u.status} />
                  {u.role && (
                    <span className="ml-1.5 hidden font-mono text-[10px] text-muted-foreground sm:inline">
                      {u.role}
                    </span>
                  )}
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                  {u.createdAt.toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <UserActionsDialog user={u} isSelf={u.id === admin.id} />
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
