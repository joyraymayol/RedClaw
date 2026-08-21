"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isForeignKeyConstraintError, isUniqueConstraintError } from "@/lib/prisma-errors";
import { productSchema } from "@/lib/validations/product";

export type ProductActionState = {
  error?: string;
  success?: boolean;
};

function parseForm(formData: FormData) {
  return productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
}

export async function createProduct(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  await requireRole("ADMIN", "HEAD");

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    await prisma.product.create({ data: parsed.data });
  } catch (e) {
    if (isUniqueConstraintError(e, "name")) {
      return { error: "A product with that name already exists." };
    }
    throw e;
  }

  revalidatePath("/products");
  return { success: true };
}

export async function updateProduct(
  _prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  await requireRole("ADMIN", "HEAD");

  const productId = String(formData.get("productId") ?? "");
  if (!productId) return { error: "Missing product." };

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const { count } = await prisma.product.updateMany({
      where: { id: productId },
      data: parsed.data,
    });
    if (count === 0) return { error: "Product not found." };
  } catch (e) {
    if (isUniqueConstraintError(e, "name")) {
      return { error: "A product with that name already exists." };
    }
    throw e;
  }

  revalidatePath("/products");
  return { success: true };
}

export async function deleteProduct(productId: string): Promise<ProductActionState> {
  await requireRole("ADMIN", "HEAD");
  if (!productId) return { error: "Missing product." };

  try {
    await prisma.product.delete({ where: { id: productId } });
  } catch (e) {
    if (isForeignKeyConstraintError(e)) {
      return { error: "Can't delete — an asset still lists this as a capability or current product." };
    }
    throw e;
  }

  revalidatePath("/products");
  return { success: true };
}
