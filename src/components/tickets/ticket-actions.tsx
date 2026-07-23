import {
  BanIcon,
  CheckIcon,
  PlayIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  ThumbsDownIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";

import { SimpleActionButton } from "@/components/tickets/simple-action-button";
import { TicketAssignDialog } from "@/components/tickets/ticket-assign-dialog";
import { TicketFlagDialog } from "@/components/tickets/ticket-flag-dialog";
import { TicketHoldDialog } from "@/components/tickets/ticket-hold-dialog";
import { TicketNoteDialog } from "@/components/tickets/ticket-note-dialog";
import { can, type Actor, type TicketContext } from "@/lib/authz";
import {
  approveSetupMaintenance,
  approveSetupQa,
  cancelTicket,
  closeTicket,
  escalateVerification,
  rejectReview,
  rejectSetup,
  reopenTicket,
  resolveTicket,
  resumeTicket,
  startWork,
  verifyTicket,
} from "@/lib/actions/tickets";

type TechnicianOption = { id: string; name: string };
type AssetOption = { id: string; assetCode: string; name: string; categoryId: string; categoryName: string };

export function TicketActions({
  actor,
  ticket,
  technicians,
  assetOptions,
  currentAssetIds,
}: {
  actor: Actor;
  ticket: TicketContext & { id: string };
  technicians: TechnicianOption[];
  assetOptions: AssetOption[];
  currentAssetIds: readonly string[];
}) {
  const buttons: React.ReactNode[] = [];

  if (can(actor, "assignTicket", ticket).allowed) {
    buttons.push(
      <TicketAssignDialog
        key="assign"
        ticketId={ticket.id}
        technicians={technicians}
        currentAssigneeIds={ticket.assigneeIds}
        mode="assign"
      />
    );
  }
  if (can(actor, "updateAssignees", ticket).allowed) {
    buttons.push(
      <TicketAssignDialog
        key="manage"
        ticketId={ticket.id}
        technicians={technicians}
        currentAssigneeIds={ticket.assigneeIds}
        mode="manage"
      />
    );
  }
  if (can(actor, "reflagAssets", ticket).allowed) {
    buttons.push(
      <TicketFlagDialog
        key="reflag"
        ticketId={ticket.id}
        assets={assetOptions}
        currentAssetIds={currentAssetIds}
      />
    );
  }
  if (can(actor, "startWork", ticket).allowed) {
    buttons.push(
      <SimpleActionButton
        key="start"
        action={startWork}
        ticketId={ticket.id}
        label="Start work"
        pendingLabel="Starting…"
        icon={<PlayIcon className="size-4" />}
      />
    );
  }
  if (can(actor, "holdTicket", ticket).allowed) {
    buttons.push(<TicketHoldDialog key="hold" ticketId={ticket.id} />);
  }
  if (can(actor, "resumeTicket", ticket).allowed) {
    buttons.push(
      <SimpleActionButton
        key="resume"
        action={resumeTicket}
        ticketId={ticket.id}
        label="Resume"
        pendingLabel="Resuming…"
        icon={<PlayIcon className="size-4" />}
        variant="outline"
      />
    );
  }
  if (can(actor, "resolveTicket", ticket).allowed) {
    buttons.push(
      <SimpleActionButton
        key="resolve"
        action={resolveTicket}
        ticketId={ticket.id}
        label="Mark resolved"
        pendingLabel="Saving…"
        icon={<WrenchIcon className="size-4" />}
      />
    );
  }
  if (can(actor, "verifyTicket", ticket).allowed) {
    buttons.push(
      <SimpleActionButton
        key="verify"
        action={verifyTicket}
        ticketId={ticket.id}
        label="Confirm it's fixed"
        pendingLabel="Confirming…"
        icon={<CheckIcon className="size-4" />}
      />
    );
  }
  if (can(actor, "reopenTicket", ticket).allowed) {
    buttons.push(
      <TicketNoteDialog
        key="reopen"
        action={reopenTicket}
        ticketId={ticket.id}
        triggerLabel="Not fixed"
        triggerIcon={<ThumbsDownIcon className="size-4" />}
        triggerVariant="outline"
        title="Send this back"
        description="Say what's still wrong — it goes back to the same technician by default."
        notePlaceholder="Still making the same noise after the fix…"
        submitLabel="Reopen ticket"
      />
    );
  }
  if (can(actor, "escalateVerification", ticket).allowed) {
    buttons.push(
      <SimpleActionButton
        key="escalate"
        action={escalateVerification}
        ticketId={ticket.id}
        label="Escalate to review"
        pendingLabel="Escalating…"
        icon={<ShieldAlertIcon className="size-4" />}
        variant="outline"
      />
    );
  }
  if (can(actor, "closeTicket", ticket).allowed) {
    buttons.push(
      <SimpleActionButton
        key="close"
        action={closeTicket}
        ticketId={ticket.id}
        label="Close ticket"
        pendingLabel="Closing…"
        icon={<CheckIcon className="size-4" />}
      />
    );
  }
  if (can(actor, "rejectReview", ticket).allowed) {
    buttons.push(
      <TicketNoteDialog
        key="rejectReview"
        action={rejectReview}
        ticketId={ticket.id}
        triggerLabel="Send back to technician"
        triggerIcon={<RotateCcwIcon className="size-4" />}
        triggerVariant="outline"
        title="Send back for more work"
        description="Explain what still needs fixing before this can close."
        notePlaceholder="QA found the guard is still loose…"
        submitLabel="Send back"
      />
    );
  }
  if (can(actor, "approveSetupMaintenance", ticket).allowed) {
    buttons.push(
      <SimpleActionButton
        key="approveSetupMaintenance"
        action={approveSetupMaintenance}
        ticketId={ticket.id}
        label="Approve (Maintenance)"
        pendingLabel="Approving…"
        icon={<CheckIcon className="size-4" />}
      />
    );
  }
  if (can(actor, "approveSetupQa", ticket).allowed) {
    buttons.push(
      <SimpleActionButton
        key="approveSetupQa"
        action={approveSetupQa}
        ticketId={ticket.id}
        label="Approve (QA)"
        pendingLabel="Approving…"
        icon={<CheckIcon className="size-4" />}
      />
    );
  }
  if (can(actor, "rejectSetup", ticket).allowed) {
    buttons.push(
      <TicketNoteDialog
        key="rejectSetup"
        action={rejectSetup}
        ticketId={ticket.id}
        triggerLabel="Send back to technician"
        triggerIcon={<RotateCcwIcon className="size-4" />}
        triggerVariant="outline"
        title="Send this machine setup back"
        description="Explain what still needs doing before this setup can be approved."
        notePlaceholder="Mold alignment is off — re-seat and re-check…"
        submitLabel="Send back"
      />
    );
  }
  if (can(actor, "cancelTicket", ticket).allowed) {
    const isAdmin = actor.role === "ADMIN" || actor.role === "HEAD";
    buttons.push(
      <TicketNoteDialog
        key="cancel"
        action={cancelTicket}
        ticketId={ticket.id}
        triggerLabel="Cancel ticket"
        triggerIcon={isAdmin ? <BanIcon className="size-4" /> : <XIcon className="size-4" />}
        triggerVariant="destructive"
        title="Cancel this ticket"
        description={
          isAdmin
            ? "Explain why — e.g. a duplicate of another ticket."
            : "This withdraws the ticket. You can raise a new one any time."
        }
        notePlaceholder={isAdmin ? "Duplicate of TKT-2026-0339" : undefined}
        noteRequired={isAdmin}
        submitLabel="Cancel ticket"
      />
    );
  }

  if (buttons.length === 0) return null;

  return <div className="flex flex-wrap items-start gap-2">{buttons}</div>;
}
