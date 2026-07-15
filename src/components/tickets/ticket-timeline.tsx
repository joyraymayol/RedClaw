import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import type { TicketStatus } from "@/generated/prisma/enums";

type TimelineEntry = {
  id: string;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus;
  note: string | null;
  createdAt: Date;
  changedBy: { name: string };
};

export function TicketTimeline({ history }: { history: TimelineEntry[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <ol className="space-y-4">
      {history.map((h) => (
        <li key={h.id} className="flex gap-3 text-sm">
          <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium">{h.changedBy.name}</span>
              <span className="text-muted-foreground">
                {h.fromStatus ? "moved this to" : "created this as"}
              </span>
              <TicketStatusBadge status={h.toStatus} />
            </div>
            {h.note && (
              <p className="mt-0.5 text-muted-foreground">{h.note}</p>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground/70">
              {h.createdAt.toLocaleString("en-PH", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
