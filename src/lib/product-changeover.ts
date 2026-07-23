import { ConflictError } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Apply a product changeover to an asset inside an existing transaction: the
 * shared core behind both the manual `setCurrentProduct` action and the
 * Machine-Setup QA-close mold update. Enforces the four invariants (category
 * tracks products, not retired, product is a capability, no-op if unchanged)
 * and appends a `ProductChangeLog` entry when it actually changes.
 *
 * Returns `true` if the product changed, `false` if it was already set (no-op).
 * Throws `ConflictError` on an invariant violation so the caller's transaction
 * rolls back rather than closing a ticket with an invalid mold.
 */
export async function applyCurrentProduct(
  tx: Prisma.TransactionClient,
  { assetId, productId, changedById }: { assetId: string; productId: string | null; changedById: string }
): Promise<boolean> {
  const asset = await tx.asset.findUnique({
    where: { id: assetId },
    include: {
      category: { select: { tracksProducts: true } },
      productCapabilities: { select: { productId: true } },
    },
  });
  if (!asset) throw new ConflictError("Asset not found.");
  if (!asset.category.tracksProducts) {
    throw new ConflictError("This asset's category doesn't track products.");
  }
  if (asset.status === "RETIRED") {
    throw new ConflictError("Retired assets can't have a product changeover.");
  }
  if (productId && !asset.productCapabilities.some((c) => c.productId === productId)) {
    throw new ConflictError("Choose a product this asset is capable of running.");
  }
  if (productId === asset.currentProductId) return false;

  await tx.asset.update({ where: { id: assetId }, data: { currentProductId: productId } });
  await tx.productChangeLog.create({ data: { assetId, productId, changedById } });
  return true;
}
