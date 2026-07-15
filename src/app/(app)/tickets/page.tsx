import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronsUpDownIcon,
  PlusIcon,
} from "lucide-react";

import { TicketPriorityBadge } from "@/components/tickets/ticket-priority-badge";
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import {
  TicketsPerPageSelect,
  TicketsSearch,
} from "@/components/tickets/tickets-table-controls";
import { Button, buttonVariants } from "@/components/ui/button";
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
import type { Prisma, TicketStatus } from "@/generated/prisma/client";
import { requireActiveUser } from "@/lib/auth";
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

const FILTERS: { key: string; label: string; where?: Prisma.TicketWhereInput }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open", where: { status: { in: OPEN_STATUSES } } },
  { key: "active", label: "Active", where: { status: { in: ACTIVE_STATUSES } } },
  {
    key: "attention",
    label: "Needs attention",
    where: { status: { in: ATTENTION_STATUSES } },
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

type TableState = {
  filter: string;
  q: string;
  perPage: number;
  sort: string | null;
  dir: SortDir;
};

function tableHref(state: TableState, page?: number) {
  const params = new URLSearchParams();
  if (state.filter !== "all") params.set("filter", state.filter);
  if (state.q) params.set("q", state.q);
  if (state.perPage !== DEFAULT_PER_PAGE) params.set("perPage", String(state.perPage));
  if (state.sort) {
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
    q?: string;
    page?: string;
    perPage?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const user = await requireActiveUser();
  const params = await searchParams;

  const filter = FILTERS.find((f) => f.key === params.filter) ?? FILTERS[0];
  const q = params.q?.trim() ?? "";
  const perPageParam = Number(params.perPage);
  const perPage = (PER_PAGE_OPTIONS as readonly number[]).includes(perPageParam)
    ? perPageParam
    : DEFAULT_PER_PAGE;
  const sort = params.sort && params.sort in SORT_COLUMNS ? params.sort : null;
  const dir: SortDir = params.dir === "desc" ? "desc" : "asc";
  const state: TableState = { filter: filter.key, q, perPage, sort, dir };

  // Requesters see their own tickets; technicians see what's assigned to
  // them; admins/supervisors/head see everything (plan §1 — the page just
  // narrows what's visible, `can()` is still the real gate on every action).
  const scope: Prisma.TicketWhereInput =
    user.role === "REQUESTER"
      ? { requesterId: user.id }
      : user.role === "TECHNICIAN"
        ? { assignedTechnicianId: user.id }
        : {};

  const where: Prisma.TicketWhereInput = {
    ...scope,
    ...filter.where,
    ...(q && {
      OR: [
        { ticketNumber: { contains: q, mode: "insensitive" } },
        { title: { contains: q, mode: "insensitive" } },
        { machine: { assetCode: { contains: q, mode: "insensitive" } } },
        { machine: { name: { contains: q, mode: "insensitive" } } },
      ],
    }),
  };

  const total = await prisma.ticket.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageParam = Math.floor(Number(params.page));
  const page = Math.min(Math.max(pageParam || 1, 1), totalPages);

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: [
      ...(sort ? [SORT_COLUMNS[sort](dir)] : [{ createdAt: "desc" as const }]),
      { id: "asc" },
    ],
    skip: (page - 1) * perPage,
    take: perPage,
    include: {
      machine: { select: { assetCode: true, name: true } },
      technician: { select: { name: true } },
    },
  });

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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1">
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
        <TicketsSearch />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
          <TableHeader>
            <TableRow>
              <SortableHead column="ticketNumber" state={state}>
                Ticket
              </SortableHead>
              <TableHead>Title</TableHead>
              <TableHead className="hidden md:table-cell">Machine</TableHead>
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
                    className={cn(buttonVariants({ variant: "outline", size: "xs" }), "font-mono")}
                  >
                    {t.ticketNumber}
                  </Link>
                </TableCell>
                <TableCell className="max-w-64 truncate">{t.title}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {t.machine.assetCode}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {t.technician?.name ?? "—"}
                </TableCell>
                <TableCell>
                  <TicketPriorityBadge priority={t.priority} />
                </TableCell>
                <TableCell>
                  <TicketStatusBadge status={t.status} />
                </TableCell>
                <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                  {t.createdAt.toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? "0 tickets"
            : `Showing ${rangeStart}–${rangeEnd} of ${total} ticket${total === 1 ? "" : "s"}`}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <TicketsPerPageSelect />
          <div className="flex items-center gap-1 text-sm">
            {page > 1 ? (
              <Link
                href={tableHref(state, page - 1)}
                className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                Previous
              </Link>
            ) : (
              <span className="px-2.5 py-1.5 text-muted-foreground/40">Previous</span>
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
              <span className="px-2.5 py-1.5 text-muted-foreground/40">Next</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
