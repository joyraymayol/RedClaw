import { ProductFormDialog } from "@/components/products/product-form-dialog";
import type { Product } from "@/generated/prisma/client";

export function ProductListCard({
  product,
  canManage,
}: {
  product: Product;
  canManage: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-card px-4 py-3 shadow-xs">
      <div className="min-w-0">
        <h3 className="break-words text-sm font-medium">{product.name}</h3>
        {product.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {product.description}
          </p>
        )}
      </div>
      {canManage && <ProductFormDialog product={product} />}
    </div>
  );
}
