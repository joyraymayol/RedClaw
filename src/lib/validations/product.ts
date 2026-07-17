import { z } from "zod";

import { optionalText } from "@/lib/validations/shared";

export const productSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(120),
  description: optionalText(500),
});

export type ProductInput = z.infer<typeof productSchema>;

export const productCapabilitiesSchema = z.object({
  assetId: z.string().trim().min(1),
  productIds: z.array(z.string().trim().min(1)).max(50),
});

export const setCurrentProductSchema = z.object({
  assetId: z.string().trim().min(1),
  productId: z.preprocess(
    (v) => (v === null || v === "" || v === "__none__" ? null : v),
    z.string().min(1).nullable()
  ),
});
