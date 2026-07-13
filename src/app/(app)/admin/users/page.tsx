import type { Metadata } from "next";
import Link from "next/link";

import { UserActionsDialog } from "@/components/admin/user-actions-dialog";
import { UserStatusBadge } from "@/components/admin/user-status-badge";
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

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const admin = await requireRole("ADMIN", "HEAD");
  const { filter: filterParam } = await searchParams;

  const filter = FILTERS.find((f) => f.key === filterParam) ?? FILTERS[0];

  const [users, pendingCount] = await Promise.all([
    prisma.user.findMany({
      where: filter.where,
      // Enum order puts the two pending states first.
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.user.count({ where: { status: "PENDING_APPROVAL" } }),
  ]);

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

      <div className="flex items-center gap-1">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={
              f.key === "all" ? "/admin/users" : `/admin/users?filter=${f.key}`
            }
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

      <div className="overflow-x-auto rounded-lg border">
        {/* Narrow screens keep three columns (name+email, status, actions);
            the rest appear as the viewport widens. Full details and all
            actions live in the per-row dialog. */}
        <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead className="hidden lg:table-cell">Department</TableHead>
              <TableHead className="hidden lg:table-cell">Position</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Joined</TableHead>
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
                  No accounts match this filter.
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
    </div>
  );
}
