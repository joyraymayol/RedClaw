import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RemarkThread } from "@/components/tickets/remark-thread";
import { TicketActions } from "@/components/tickets/ticket-actions";
import { TicketPriorityBadge } from "@/components/tickets/ticket-priority-badge";
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import { TicketTimeline } from "@/components/tickets/ticket-timeline";
import { Separator } from "@/components/ui/separator";
import { can } from "@/lib/authz";
import { requireActiveUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toTicketContext } from "@/lib/ticket-context";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}): Promise<Metadata> {
  const { ticketId } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { ticketNumber: true, title: true },
  });
  return { title: ticket ? `${ticket.ticketNumber} · ${ticket.title}` : "Ticket" };
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const user = await requireActiveUser();
  const { ticketId } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      machine: { select: { id: true, assetCode: true, name: true } },
      requester: { select: { id: true, name: true } },
      assignments: {
        where: { unassignedAt: null },
        orderBy: { assignedAt: "asc" },
        include: { technician: { select: { id: true, name: true } } },
      },
      problemType: { select: { name: true } },
      suggestedSolution: { select: { title: true } },
      statusHistory: {
        orderBy: { createdAt: "asc" },
        include: { changedBy: { select: { name: true } } },
      },
      remarks: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true } } },
      },
    },
  });
  if (!ticket) notFound();

  const members = ticket.assignments.map((a) => a.technician);
  const ctx = toTicketContext(ticket);

  // Requesters and technicians only see their own tickets; admin/supervisor/
  // head see everything. `can()` is still the real gate on every action —
  // this just keeps someone from reading a ticket that isn't theirs.
  const isParticipant = ticket.requesterId === user.id || ctx.assigneeIds.includes(user.id);
  const isStaff = user.role === "ADMIN" || user.role === "SUPERVISOR" || user.role === "HEAD";
  if (!isParticipant && !isStaff) notFound();

  const technicians =
    user.role === "ADMIN" || user.role === "HEAD"
      ? await prisma.user.findMany({
          where: { role: "TECHNICIAN", status: "ACTIVE" },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : [];

  const canComment = can(user, "addRemark", ctx).allowed;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/tickets" className="text-sm text-muted-foreground hover:underline">
          ← Tickets
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <p className="font-mono text-xs text-muted-foreground">{ticket.ticketNumber}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{ticket.title}</h1>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <TicketStatusBadge status={ticket.status} />
            <TicketPriorityBadge priority={ticket.priority} />
            {ticket.reopenCount > 0 && (
              <span className="text-xs text-muted-foreground">
                Reopened {ticket.reopenCount}×
              </span>
            )}
          </div>
        </div>
        <TicketActions
          actor={user}
          ticket={{ ...ctx, id: ticket.id }}
          technicians={technicians}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="space-y-2 rounded-lg border p-4">
            <h2 className="text-sm font-medium text-muted-foreground">Description</h2>
            <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <h2 className="text-sm font-medium text-muted-foreground">Remarks</h2>
            <RemarkThread
              ticketId={ticket.id}
              remarks={ticket.remarks}
              canComment={canComment}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-3 rounded-lg border p-4 text-sm">
            <h2 className="text-sm font-medium text-muted-foreground">Details</h2>
            <dl className="space-y-2">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Machine</dt>
                <dd>
                  <Link href={`/machines/${ticket.machine.id}`} className="hover:underline">
                    {ticket.machine.assetCode}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Requester</dt>
                <dd>{ticket.requester.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                  {members.length === 1 ? "Technician" : "Technicians"}
                </dt>
                <dd>{members.length > 0 ? members.map((m) => m.name).join(", ") : "Unassigned"}</dd>
              </div>
              {ticket.problemType && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Problem type</dt>
                  <dd>{ticket.problemType.name}</dd>
                </div>
              )}
              {ticket.suggestedSolution && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Suggested fix</dt>
                  <dd>{ticket.suggestedSolution.title}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Raised</dt>
                <dd>
                  {ticket.createdAt.toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <h2 className="text-sm font-medium text-muted-foreground">Activity</h2>
            <Separator />
            <TicketTimeline history={ticket.statusHistory} />
          </div>
        </div>
      </div>
    </div>
  );
}
