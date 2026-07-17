import { z } from "zod";

import { checkboxBoolean, optionalText } from "@/lib/validations/shared";

export const assetCategorySchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(80),
  description: optionalText(500),
  tracksProducts: checkboxBoolean(),
  supportsParentAsset: checkboxBoolean(),
});

export type AssetCategoryInput = z.infer<typeof assetCategorySchema>;
