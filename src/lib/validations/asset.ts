import { z } from "zod";

import { optionalDate, optionalId, optionalText } from "@/lib/validations/shared";

export const assetStatusSchema = z.enum(["OPERATIONAL", "DOWN", "UNDER_MAINTENANCE"]);

export const assetSchema = z.object({
  assetCode: z.string().trim().min(1, "Give it an asset code").max(40),
  name: z.string().trim().min(1, "Give it a name").max(120),
  categoryId: z.string().trim().min(1, "Choose a category"),
  typeId: optionalId(),
  parentAssetId: optionalId(),
  pmChecklistTemplateId: optionalId(),
  location: optionalText(120),
  status: assetStatusSchema,
  serialNumber: optionalText(80),
  manufacturer: optionalText(120),
  model: optionalText(120),
  purchaseDate: optionalDate(),
  installedAt: optionalDate(),
  commissionedAt: optionalDate(),
  warrantyExpiresAt: optionalDate(),
  notes: optionalText(2000),
});

export type AssetInput = z.infer<typeof assetSchema>;
