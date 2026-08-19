"use server";

import { revalidatePath } from "next/cache";

import { diffIds } from "@/lib/id-diff";
import { requireRole } from "@/lib/auth";
import { ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintError } from "@/lib/prisma-errors";
import { applyCurrentProduct } from "@/lib/product-changeover";
import { assetSchema } from "@/lib/validations/asset";
import { assetChecklistsSchema } from "@/lib/validations/pm-checklist";
import { productCapabilitiesSchema, setCurrentProductSchema } from "@/lib/validations/product";

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

export async function updateProductCapabilities(
  _prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  await requireRole("ADMIN", "HEAD");

  const parsed = productCapabilitiesSchema.safeParse({
    assetId: formData.get("assetId"),
    productIds: formData.getAll("productIds"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { assetId, productIds } = parsed.data;

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { productCapabilities: true },
  });
  if (!asset) return { error: "Asset not found." };

  const { toAdd, toRemove } = diffIds(
    asset.productCapabilities.map((c) => c.productId),
    productIds
  );
  if (toAdd.length === 0 && toRemove.length === 0) {
    return { error: "No capability changes." };
  }

  await prisma.$transaction(async (tx) => {
    if (toRemove.length > 0) {
      await tx.assetProduct.deleteMany({
        where: { assetId, productId: { in: toRemove } },
      });
    }
    if (toAdd.length > 0) {
      await tx.assetProduct.createMany({
        data: toAdd.map((productId) => ({ assetId, productId })),
      });
    }
    // Removing the current product's capability also clears the current
    // product — it's no longer something this asset can be set to.
    if (asset.currentProductId && toRemove.includes(asset.currentProductId)) {
      await tx.asset.update({ where: { id: assetId }, data: { currentProductId: null } });
    }
  });

  revalidatePath(`/assets/${assetId}`);
  return { success: true };
}

export async function updateAssetChecklists(
  _prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  await requireRole("ADMIN", "HEAD");

  const parsed = assetChecklistsSchema.safeParse({
    assetId: formData.get("assetId"),
    templateIds: formData.getAll("templateIds"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { assetId, templateIds } = parsed.data;

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { checklistAssignments: true },
  });
  if (!asset) return { error: "Asset not found." };

  const { toAdd, toRemove } = diffIds(
    asset.checklistAssignments.map((a) => a.templateId),
    templateIds
  );
  if (toAdd.length === 0 && toRemove.length === 0) {
    return { error: "No checklist changes." };
  }

  await prisma.$transaction(async (tx) => {
    if (toRemove.length > 0) {
      await tx.assetPmChecklistTemplate.deleteMany({
        where: { assetId, templateId: { in: toRemove } },
      });
    }
    if (toAdd.length > 0) {
      await tx.assetPmChecklistTemplate.createMany({
        data: toAdd.map((templateId) => ({ assetId, templateId })),
      });
    }
  });

  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/pm-checklists");
  return { success: true };
}

export async function setCurrentProduct(
  _prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  const user = await requireRole("ADMIN", "HEAD");

  const parsed = setCurrentProductSchema.safeParse({
    assetId: formData.get("assetId"),
    productId: formData.get("productId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { assetId, productId } = parsed.data;

  try {
    const changed = await prisma.$transaction((tx) =>
      applyCurrentProduct(tx, { assetId, productId, changedById: user.id })
    );
    if (!changed) return { error: "Already set to that product." };
  } catch (e) {
    if (e instanceof ConflictError) return { error: e.message };
    throw e;
  }

  revalidatePath(`/assets/${assetId}`);
  return { success: true };
}
