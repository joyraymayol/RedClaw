import { z } from "zod";

import { optionalId } from "@/lib/validations/shared";

export const solutionSchema = z.object({
  problemTypeId: z.string().min(1, "Pick a problem type"),
  assetId: optionalId(),
  title: z.string().trim().min(1, "Give it a title").max(160),
  description: z.string().trim().min(1, "Describe the fix").max(4000),
});

export type SolutionInput = z.infer<typeof solutionSchema>;
