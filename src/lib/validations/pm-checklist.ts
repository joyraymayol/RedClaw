import { z } from "zod";

import { optionalText } from "@/lib/validations/shared";

export const pmChecklistTemplateSchema = z.object({
  name: z.string().trim().min(1, "Give the checklist a name").max(120),
  description: optionalText(500),
});

export const pmChecklistItemSchema = z.object({
  templateId: z.string().min(1),
  label: z.string().trim().min(1, "Describe the task").max(300),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

/** A technician updating one snapshotted checklist item on a PM ticket. */
export const checklistResultSchema = z.object({
  ticketId: z.string().min(1),
  resultId: z.string().min(1),
  done: z.preprocess((v) => v === "true" || v === true, z.boolean()),
  remark: optionalText(500),
});

/** Asset -> checklists it carries (asset-side edit of the many-to-many). */
export const assetChecklistsSchema = z.object({
  assetId: z.string().min(1),
  templateIds: z.array(z.string().min(1)).transform((ids) => [...new Set(ids)]),
});

/** Checklist -> assets it applies to (template-side edit of the many-to-many). */
export const templateAssetsSchema = z.object({
  templateId: z.string().min(1),
  assetIds: z.array(z.string().min(1)).transform((ids) => [...new Set(ids)]),
});

export type PmChecklistTemplateInput = z.infer<typeof pmChecklistTemplateSchema>;
export type PmChecklistItemInput = z.infer<typeof pmChecklistItemSchema>;
