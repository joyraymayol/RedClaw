"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isForeignKeyConstraintError, isUniqueConstraintError } from "@/lib/prisma-errors";
import { assetTypeSchema } from "@/lib/validations/asset-type";

export type AssetTypeActionState = {
  error?: string;
  success?: boolean;
};

function parseForm(formData: FormData) {
  return assetTypeSchema.safeParse({
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
  });
}

export async function createAssetType(
  _prevState: AssetTypeActionState,
  formData: FormData
): Promise<AssetTypeActionState> {
  await requireRole("ADMIN", "HEAD");

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await prisma.assetType.create({ data: parsed.data });
  } catch (e) {
    if (isUniqueConstraintError(e, "name")) {
      return { error: "A type with that name already exists in this category." };
    }
    throw e;
  }

  revalidatePath("/assets/settings");
  return { success: true };
}

export async function updateAssetType(
  _prevState: AssetTypeActionState,
  formData: FormData
): Promise<AssetTypeActionState> {
  await requireRole("ADMIN", "HEAD");

  const typeId = String(formData.get("typeId") ?? "");
  if (!typeId) return { error: "Missing asset type." };

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const { count } = await prisma.assetType.updateMany({
      where: { id: typeId },
      data: parsed.data,
    });
    if (count === 0) return { error: "Asset type not found." };
  } catch (e) {
    if (isUniqueConstraintError(e, "name")) {
      return { error: "A type with that name already exists in this category." };
    }
    throw e;
  }

  revalidatePath("/assets/settings");
  return { success: true };
}

export async function deleteAssetType(typeId: string): Promise<AssetTypeActionState> {
  await requireRole("ADMIN", "HEAD");
  if (!typeId) return { error: "Missing asset type." };

  try {
    await prisma.assetType.delete({ where: { id: typeId } });
  } catch (e) {
    if (isForeignKeyConstraintError(e)) {
      return { error: "Can't delete — assets still use this type." };
    }
    throw e;
  }

  revalidatePath("/assets/settings");
  return { success: true };
}
