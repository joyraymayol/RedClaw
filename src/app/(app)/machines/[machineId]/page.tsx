import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MachineFormDialog } from "@/components/machines/machine-form-dialog";
import { MachineStatusBadge } from "@/components/machines/machine-status-badge";
import { TicketPriorityBadge } from "@/components/tickets/ticket-priority-badge";
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireActiveUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ machineId: string }>;
}): Promise<Metadata> {
  const { machineId } = await params;
  const machine = await prisma.machine.findUnique({
    where: { id: machineId },
    select: { assetCode: true, name: true },
  });
  return { title: machine ? `${machine.assetCode} · ${machine.name}` : "Machine" };
}

export default async function MachineDetailPage({
  params,
}: {
  params: Promise<{ machineId: string }>;
}) {
  const user = await requireActiveUser();
  const canManage = user.role === "ADMIN" || user.role === "HEAD";
  const { machineId } = await params;

  const machine = await prisma.machine.findUnique({
    where: { id: machineId },
    include: {
      tickets: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          ticketNumber: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
        },
      },
    },
  });
  if (!machine) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-xs text-muted-foreground">
            {machine.assetCode}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {machine.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
            <MachineStatusBadge status={machine.status} />
            {machine.category && <span>{machine.category}</span>}
            {machine.location && <span>· {machine.location}</span>}
          </div>
        </div>
        {canManage && <MachineFormDialog machine={machine} />}
      </div>

      {machine.notes && (
        <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          {machine.notes}
        </p>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Tickets on this machine
        </h2>
        <div className="overflow-x-auto rounded-lg border">
          <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Raised</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {machine.tickets.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No tickets raised on this machine yet.
                  </TableCell>
                </TableRow>
              )}
              {machine.tickets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/tickets/${t.id}`} className="hover:underline">
                      {t.ticketNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{t.title}</TableCell>
                  <TableCell>
                    <TicketPriorityBadge priority={t.priority} />
                  </TableCell>
                  <TableCell>
                    <TicketStatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
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
      </div>
    </div>
  );
}
