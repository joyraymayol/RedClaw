import type { Metadata } from "next";
import Link from "next/link";

import { UserRowActions } from "@/components/admin/user-row-actions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import type { AccountStatus } from "@/generated/prisma/enums";
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

const STATUS_BADGE: Record<
  AccountStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  PENDING_PROFILE: { label: "Awaiting profile", variant: "outline" },
  PENDING_APPROVAL: { label: "Needs approval", variant: "default" },
  ACTIVE: { label: "Active", variant: "secondary" },
  DISABLED: { label: "Disabled", variant: "destructive" },
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const admin = await requireRole("ADMIN", "HEAD");
  const { filter: filterParam } = await searchParams;

  const filter =
    FILTERS.find((f) => f.key === filterParam) ??
    FILTERS[0];

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
            href={f.key === "all" ? "/admin/users" : `/admin/users?filter=${f.key}`}
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
        <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Role / actions</TableHead>
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
            {users.map((u) => {
              const badge = STATUS_BADGE[u.status];
              return (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="font-mono text-xs">{u.email}</TableCell>
                  <TableCell>{u.department ?? "—"}</TableCell>
                  <TableCell>{u.position ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.createdAt.toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <UserRowActions
                      userId={u.id}
                      status={u.status}
                      role={u.role}
                      isSelf={u.id === admin.id}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
