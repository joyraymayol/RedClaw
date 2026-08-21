import { z } from "zod";

import { optionalId, optionalText } from "@/lib/validations/shared";

// Attachments (private-bucket upload) are deferred — see plan §5/§9.

export const ticketTypeSchema = z
  .enum(["MAINTENANCE", "PREVENTIVE_MAINTENANCE", "MACHINE_SETUP"])
  .default("MAINTENANCE");

export const newTicketSchema = z.object({
  type: ticketTypeSchema,
  assetId: z.string().min(1, "Select an asset"),
  problemTypeId: optionalId(),
  suggestedSolutionId: optionalId(),
  // MACHINE_SETUP only: the mold/product to switch the machine to on QA close.
  targetProductId: optionalId(),
  // PREVENTIVE_MAINTENANCE only: which of the asset's linked checklists to snapshot.
  pmChecklistTemplateId: optionalId(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  title: z.string().trim().min(5, "Give a short summary").max(120),
  description: z.string().trim().min(10, "Add a bit more detail").max(4000),
});

export type NewTicketInput = z.infer<typeof newTicketSchema>;

export const rejectSetupSchema = z.object({
  ticketId: z.string().min(1),
  note: z.string().trim().min(1, "Say why this is going back").max(500),
});

export const logMaterialSchema = z.object({
  ticketId: z.string().min(1),
  name: z.string().trim().min(1, "Name the material").max(160),
  quantity: z.string().trim().min(1, "How much was used?").max(60),
  unit: optionalText(40),
});

export const removeMaterialSchema = z.object({
  ticketId: z.string().min(1),
  materialId: z.string().min(1),
});

export const remarkSchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().trim().min(1, "Write something first").max(4000),
});

export const holdSchema = z.object({
  ticketId: z.string().min(1),
  holdReason: z.enum([
    "WAITING_PARTS",
    "WAITING_VENDOR",
    "WAITING_EXTERNAL_TECHNICIAN",
    "WAITING_TOOLS_EQUIPMENT",
    "PRODUCTION_SCHEDULE_CONFLICT",
    "FURTHER_DIAGNOSIS_REQUIRED",
    "OTHER",
  ]),
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

export const flagAssetsSchema = z.object({
  ticketId: z.string().min(1),
  assetIds: z
    .array(z.string().min(1))
    .min(1, "Pick at least one asset")
    .max(10, "Pick at most 10 assets")
    .transform((ids) => [...new Set(ids)]),
});
