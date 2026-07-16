import { z } from "zod";

import { optionalId, optionalText } from "@/lib/validations/shared";

// Attachments (private-bucket upload) are deferred — see plan §5/§9.

export const newTicketSchema = z.object({
  machineId: z.string().min(1, "Select a machine"),
  problemTypeId: optionalId(),
  suggestedSolutionId: optionalId(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  title: z.string().trim().min(5, "Give a short summary").max(120),
  description: z.string().trim().min(10, "Add a bit more detail").max(4000),
});

export type NewTicketInput = z.infer<typeof newTicketSchema>;

export const remarkSchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().trim().min(1, "Write something first").max(4000),
});

export const holdSchema = z.object({
  ticketId: z.string().min(1),
  holdReason: z.enum(["WAITING_PARTS", "WAITING_VENDOR", "OTHER"]),
  note: z.string().trim().min(1, "Say why you're pausing this").max(500),
});

export const cancelSchema = z.object({
  ticketId: z.string().min(1),
  note: optionalText(500),
});

export const adminCancelSchema = z.object({
  ticketId: z.string().min(1),
  note: z.string().trim().min(1, "A note is required when cancelling").max(500),
});

export const reopenSchema = z.object({
  ticketId: z.string().min(1),
  note: z.string().trim().min(1, "Say what's still wrong").max(500),
});

export const rejectReviewSchema = z.object({
  ticketId: z.string().min(1),
  note: z.string().trim().min(1, "Say why this is going back").max(500),
});

export const assignSchema = z.object({
  ticketId: z.string().min(1),
  technicianIds: z
    .array(z.string().min(1))
    .min(1, "Pick at least one technician")
    .max(10, "Pick at most 10 technicians")
    .transform((ids) => [...new Set(ids)]),
});

export const ticketIdSchema = z.object({
  ticketId: z.string().min(1),
});
