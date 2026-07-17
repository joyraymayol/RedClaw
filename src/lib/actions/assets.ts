"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { assetSchema } from "@/lib/validations/asset";

export type AssetActionState = {
  error?: string;
  success?: boolean;
};

function parseAssetForm(formData: FormData) {
  const typeId = formData.get("typeId");
  const parentAssetId = formData.get("parentAssetId");
  return assetSchema.safeParse({
    assetCode: formData.get("assetCode"),
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    typeId: typeId === "__none__" ? "" : typeId,
    parentAssetId: parentAssetId === "__none__" ? "" : parentAssetId,
    location: formData.get("location"),
    status: formData.get("status"),
    serialNumber: formData.get("serialNumber"),
    manufacturer: formData.get("manufacturer"),
    model: formData.get("model"),
    purchaseDate: formData.get("purchaseDate"),
    installedAt: formData.get("installedAt"),
    commissionedAt: formData.get("commissionedAt"),
    warrantyExpiresAt: formData.get("warrantyExpiresAt"),
    notes: formData.get("notes"),
  });
}

export async function createAsset(
  _prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  await requireRole("ADMIN", "HEAD");

  const parsed = parseAssetForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    await prisma.asset.create({ data: parsed.data });
  } catch (e) {
    if (isUniqueConstraintError(e, "assetCode")) {
      return { error: "An asset with that asset code already exists." };
    }
    throw e;
  }

  revalidatePath("/assets");
  return { success: true };
}

export async function updateAsset(
  _prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  await requireRole("ADMIN", "HEAD");

  const assetId = String(formData.get("assetId") ?? "");
  if (!assetId) return { error: "Missing asset." };

  const parsed = parseAssetForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  if (parsed.data.parentAssetId === assetId) {
    return { error: "An asset can't be its own parent." };
  }

  try {
    const { count } = await prisma.asset.updateMany({
      where: { id: assetId },
      data: parsed.data,
    });
    if (count === 0) return { error: "Asset not found." };
  } catch (e) {
    if (isUniqueConstraintError(e, "assetCode")) {
      return { error: "An asset with that asset code already exists." };
    }
    throw e;
  }

  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  return { success: true };
}

export async function retireAsset(assetId: string): Promise<AssetActionState> {
  await requireRole("ADMIN", "HEAD");
  if (!assetId) return { error: "Missing asset." };

  const { count } = await prisma.asset.updateMany({
    where: { id: assetId, status: { not: "RETIRED" } },
    data: { status: "RETIRED", retiredAt: new Date() },
  });
  if (count === 0) return { error: "Asset not found or already retired." };

  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  return { success: true };
}

export async function unretireAsset(assetId: string): Promise<AssetActionState> {
  await requireRole("ADMIN", "HEAD");
  if (!assetId) return { error: "Missing asset." };

  const { count } = await prisma.asset.updateMany({
    where: { id: assetId, status: "RETIRED" },
    data: { status: "OPERATIONAL", retiredAt: null },
  });
  if (count === 0) return { error: "Asset not found or not retired." };

  revalidatePath("/assets");
  revalidatePath(`/assets/${assetId}`);
  return { success: true };
}
