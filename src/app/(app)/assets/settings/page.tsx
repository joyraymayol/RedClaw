import type { Metadata } from "next";

import { AssetCategoryFormDialog } from "@/components/assets/asset-category-form-dialog";
import { AssetTypeFormDialog } from "@/components/assets/asset-type-form-dialog";
import { Badge } from "@/components/ui/badge";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Asset settings" };

export default async function AssetSettingsPage() {
  await requireRole("ADMIN", "HEAD");

  const [categories, types] = await Promise.all([
    prisma.assetCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.assetType.findMany({
      orderBy: { name: "asc" },
      include: { category: { select: { name: true } } },
    }),
  ]);
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Asset settings</h1>
        <p className="text-sm text-muted-foreground">
          Categories and types used across the asset form.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">Categories</h2>
          <AssetCategoryFormDialog />
        </div>

        {categories.length === 0 && (
          <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
            No categories yet.
          </p>
        )}

        <div className="space-y-3">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{c.name}</h3>
                  {c.tracksProducts && <Badge variant="secondary">Tracks products</Badge>}
                  {c.supportsParentAsset && (
                    <Badge variant="secondary">Supports parent asset</Badge>
                  )}
                </div>
                {c.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                )}
              </div>
              <AssetCategoryFormDialog category={c} />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Asset types</h2>
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground">Add a category first.</p>
            )}
          </div>
          <AssetTypeFormDialog categories={categoryOptions} />
        </div>

        {types.length === 0 ? (
          <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
            No asset types yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <ul className="divide-y">
              {types.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-muted-foreground">{t.category.name}</span>
                  </div>
                  <AssetTypeFormDialog type={t} categories={categoryOptions} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Products</h2>
        <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
          Product capability tracking lands in a later phase, once the
          Product/AssetProduct tables exist.
        </p>
      </div>
    </div>
  );
}
