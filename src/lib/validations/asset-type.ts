import { z } from "zod";

export const assetTypeSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(80),
  categoryId: z.string().trim().min(1, "Choose a category"),
});

export type AssetTypeInput = z.infer<typeof assetTypeSchema>;
