import { z } from "zod";

import { optionalText } from "@/lib/validations/shared";

export const machineStatusSchema = z.enum(["OPERATIONAL", "DOWN", "UNDER_MAINTENANCE"]);

export const machineSchema = z.object({
  assetCode: z.string().trim().min(1, "Give it an asset code").max(40),
  name: z.string().trim().min(1, "Give it a name").max(120),
  category: optionalText(60),
  location: optionalText(120),
  status: machineStatusSchema,
  notes: optionalText(2000),
});

export type MachineInput = z.infer<typeof machineSchema>;
