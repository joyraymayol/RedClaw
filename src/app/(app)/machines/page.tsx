import type { Metadata } from "next";
import Link from "next/link";

import { MachineFormDialog } from "@/components/machines/machine-form-dialog";
import { MachinesSearch } from "@/components/machines/machines-search";
import { MachineStatusBadge } from "@/components/machines/machine-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { requireActiveUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Machines" };

export default async function MachinesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireActiveUser();
  const canManage = user.role === "ADMIN" || user.role === "HEAD";
  const { q: qParam } = await searchParams;
  const q = qParam?.trim() ?? "";

  const where: Prisma.MachineWhereInput = q
    ? {
        OR: [
          { assetCode: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { category: { contains: q, mode: "insensitive" } },
          { location: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const machines = await prisma.machine.findMany({
    where,
    orderBy: { assetCode: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Machines</h1>
          <p className="text-sm text-muted-foreground">
            Assets tickets can be raised against.
          </p>
        </div>
        {canManage && <MachineFormDialog />}
      </div>

      <MachinesSearch />

      <div className="overflow-x-auto rounded-lg border">
        <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
          <TableHeader>
            <TableRow>
              <TableHead>Asset code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Category</TableHead>
              <TableHead className="hidden md:table-cell">Location</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Edit</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {machines.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 6 : 5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {q ? `No machines match "${q}".` : "No machines yet."}
                </TableCell>
              </TableRow>
            )}
            {machines.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono text-xs font-medium">
                  <Link
                    href={`/machines/${m.id}`}
                    className="hover:underline"
                  >
                    {m.assetCode}
                  </Link>
                </TableCell>
                <TableCell>{m.name}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {m.category ?? "—"}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {m.location ?? "—"}
                </TableCell>
                <TableCell>
                  <MachineStatusBadge status={m.status} />
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <MachineFormDialog machine={m} />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
