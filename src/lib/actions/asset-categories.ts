"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isForeignKeyConstraintError, isUniqueConstraintError } from "@/lib/prisma-errors";
import { assetCategorySchema } from "@/lib/validations/asset-category";

export type AssetCategoryActionState = {
  error?: string;
  success?: boolean;
};

function parseForm(formData: FormData) {
  return assetCategorySchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    tracksProducts: formData.get("tracksProducts"),
    supportsParentAsset: formData.get("supportsParentAsset"),
  });
}

export async function createAssetCategory(
  _prevState: AssetCategoryActionState,
  formData: FormData
): Promise<AssetCategoryActionState> {
  await requireRole("ADMIN", "HEAD");

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await prisma.assetCategory.create({ data: parsed.data });
  } catch (e) {
    if (isUniqueConstraintError(e, "name")) {
      return { error: "A category with that name already exists." };
    }
    throw e;
  }

  revalidatePath("/assets/settings");
  revalidatePath("/assets");
  return { success: true };
}

export async function updateAssetCategory(
  _prevState: AssetCategoryActionState,
  formData: FormData
): Promise<AssetCategoryActionState> {
  await requireRole("ADMIN", "HEAD");

  const categoryId = String(formData.get("categoryId") ?? "");
  if (!categoryId) return { error: "Missing category." };

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const { count } = await prisma.assetCategory.updateMany({
      where: { id: categoryId },
      data: parsed.data,
    });
    if (count === 0) return { error: "Category not found." };
  } catch (e) {
    if (isUniqueConstraintError(e, "name")) {
      return { error: "A category with that name already exists." };
    }
    throw e;
  }

  revalidatePath("/assets/settings");
  revalidatePath("/assets");
  return { success: true };
}

export async function deleteAssetCategory(categoryId: string): Promise<AssetCategoryActionState> {
  await requireRole("ADMIN", "HEAD");
  if (!categoryId) return { error: "Missing category." };

  try {
    await prisma.assetCategory.delete({ where: { id: categoryId } });
  } catch (e) {
    if (isForeignKeyConstraintError(e)) {
      return { error: "Can't delete — assets or asset types still use this category." };
    }
    throw e;
  }

  revalidatePath("/assets/settings");
  revalidatePath("/assets");
  return { success: true };
}
