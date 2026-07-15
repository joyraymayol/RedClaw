import { z } from "zod";

import { optionalText } from "@/lib/validations/shared";

export const problemTypeSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(120),
  category: optionalText(60),
  description: optionalText(2000),
});

export type ProblemTypeInput = z.infer<typeof problemTypeSchema>;
