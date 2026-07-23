import { z } from "zod";

import { requiredDate } from "@/lib/validations/shared";

/**
 * One machine row inside a Production Plan. `productId` is optional (a machine
 * may have no product assigned yet); the action further checks it's a
 * capability of that machine. The text fields are lenient — Production fills
 * what it needs and leaves the rest blank.
 */
export const planRowInputSchema = z.object({
  assetId: z.string().trim().min(1, "Missing machine"),
  statusInstruction: z.string().trim().max(2000).default(""),
  productId: z.preprocess(
    (v) => (v === null || v === "" || v === "__none__" ? undefined : v),
    z.string().min(1).optional()
  ),
  referenceCycleTime: z.string().trim().max(500).default(""),
  remarks: z.string().trim().max(2000).default(""),
});

export type PlanRowInput = z.infer<typeof planRowInputSchema>;

/** The whole create form: header + a JSON-encoded array of machine rows. */
export const createProductionPlanSchema = z
  .object({
    formNumber: z.string().trim().min(1, "Give it a form number").max(80),
    scheduleFrom: requiredDate("Pick a schedule start"),
    scheduleTo: requiredDate("Pick a schedule end"),
    effectiveDate: requiredDate("Pick an effective date"),
    rows: z.array(planRowInputSchema).min(1, "Add at least one machine row"),
  })
  .refine((v) => v.scheduleFrom <= v.scheduleTo, {
    message: "Schedule end can't be before the start",
    path: ["scheduleTo"],
  });

/** Header edit (form number / schedule / effective date) — DRAFT plans only. */
export const updatePlanHeaderSchema = z
  .object({
    planId: z.string().min(1),
    formNumber: z.string().trim().min(1, "Give it a form number").max(80),
    scheduleFrom: requiredDate("Pick a schedule start"),
    scheduleTo: requiredDate("Pick a schedule end"),
    effectiveDate: requiredDate("Pick an effective date"),
  })
  .refine((v) => v.scheduleFrom <= v.scheduleTo, {
    message: "Schedule end can't be before the start",
    path: ["scheduleTo"],
  });

/** A single-row edit. Post-approval, each changed field is logged. */
export const updatePlanRowSchema = z.object({
  rowId: z.string().min(1),
  statusInstruction: z.string().trim().max(2000).default(""),
  productId: z.preprocess(
    (v) => (v === null || v === "" || v === "__none__" ? undefined : v),
    z.string().min(1).optional()
  ),
  referenceCycleTime: z.string().trim().max(500).default(""),
  remarks: z.string().trim().max(2000).default(""),
});

/** Add/remove a designated approver. */
export const approverSchema = z.object({
  userId: z.string().min(1, "Pick a user"),
});
