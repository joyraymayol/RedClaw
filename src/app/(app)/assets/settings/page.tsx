import type { Metadata } from "next";

import { AssetCategoryFormDialog } from "@/components/assets/asset-category-form-dialog";
import { AssetTypeFormDialog } from "@/components/assets/asset-type-form-dialog";
import { ProductFormDialog } from "@/components/assets/product-form-dialog";
import { SettingsTabs } from "@/components/assets/settings-tabs";
import { Badge } from "@/components/ui/badge";
import { DebouncedSearchInput } from "@/components/ui/debounced-search-input";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_PER_PAGE } from "@/lib/constants/pagination";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Asset settings" };

const DEFAULT_TAB = "categories";

function clampPage(n: number) {
  return Math.max(1, Math.floor(n) || 1);
}

function settingsHref(
  raw: Record<string, string | undefined>,
  overrides: Record<string, string | number | undefined>
) {
  const merged = new URLSearchParams();
  const all = { ...raw, ...overrides };
  for (const [key, value] of Object.entries(all)) {
    if (value !== undefined && value !== null && value !== "") merged.set(key, String(value));
  }
  const query = merged.toString();
  return query ? `/assets/settings?${query}` : "/assets/settings";
}

export default async function AssetSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    catQ?: string;
    catPage?: string;
    typeQ?: string;
    typePage?: string;
    prodQ?: string;
    prodPage?: string;
  }>;
}) {
  await requireRole("ADMIN", "HEAD");
  const rawParams = await searchParams;

  const catQ = rawParams.catQ?.trim() ?? "";
  const typeQ = rawParams.typeQ?.trim() ?? "";
  const prodQ = rawParams.prodQ?.trim() ?? "";
  const catPageReq = clampPage(Number(rawParams.catPage));
  const typePageReq = clampPage(Number(rawParams.typePage));
  const prodPageReq = clampPage(Number(rawParams.prodPage));
  const perPage = DEFAULT_PER_PAGE;

  const categoryWhere: Prisma.AssetCategoryWhereInput = catQ
    ? {
        OR: [
          { name: { contains: catQ, mode: "insensitive" } },
          { description: { contains: catQ, mode: "insensitive" } },
        ],
      }
    : {};
  const typeWhere: Prisma.AssetTypeWhereInput = typeQ
    ? {
        OR: [
          { name: { contains: typeQ, mode: "insensitive" } },
          { category: { name: { contains: typeQ, mode: "insensitive" } } },
        ],
      }
    : {};
  const productWhere: Prisma.ProductWhereInput = prodQ
    ? {
        OR: [
          { name: { contains: prodQ, mode: "insensitive" } },
          { description: { contains: prodQ, mode: "insensitive" } },
        ],
      }
    : {};

  const [categoryTotal, typeTotal, productTotal, allCategories] = await Promise.all([
    prisma.assetCategory.count({ where: categoryWhere }),
    prisma.assetType.count({ where: typeWhere }),
    prisma.product.count({ where: productWhere }),
    prisma.assetCategory.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const categoryTotalPages = Math.max(1, Math.ceil(categoryTotal / perPage));
  const typeTotalPages = Math.max(1, Math.ceil(typeTotal / perPage));
  const productTotalPages = Math.max(1, Math.ceil(productTotal / perPage));
  const catPage = Math.min(catPageReq, categoryTotalPages);
  const typePage = Math.min(typePageReq, typeTotalPages);
  const prodPage = Math.min(prodPageReq, productTotalPages);

  const [categories, types, products] = await Promise.all([
    prisma.assetCategory.findMany({
      where: categoryWhere,
      orderBy: { name: "asc" },
      skip: (catPage - 1) * perPage,
      take: perPage,
    }),
    prisma.assetType.findMany({
      where: typeWhere,
      orderBy: { name: "asc" },
      include: { category: { select: { name: true } } },
      skip: (typePage - 1) * perPage,
      take: perPage,
    }),
    prisma.product.findMany({
      where: productWhere,
      orderBy: { name: "asc" },
      skip: (prodPage - 1) * perPage,
      take: perPage,
    }),
  ]);
  const categoryOptions = allCategories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Asset settings</h1>
        <p className="text-sm text-muted-foreground">
          Categories and types used across the asset form.
        </p>
      </div>

      <SettingsTabs defaultTab={DEFAULT_TAB}>
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="types">Asset types</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
        </TabsList>

        <TabsPanel value="categories" className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium">Categories</h2>
            <AssetCategoryFormDialog />
          </div>

          <DebouncedSearchInput
            paramName="catQ"
            placeholder="Search categories…"
            ariaLabel="Search categories"
            resetParams={["catPage"]}
          />

          {categories.length === 0 && (
            <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
              {catQ ? `No categories match "${catQ}".` : "No categories yet."}
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

          {categoryTotal > 0 && (
            <PaginationBar
              total={categoryTotal}
              page={catPage}
              totalPages={categoryTotalPages}
              rangeStart={(catPage - 1) * perPage + 1}
              rangeEnd={Math.min(catPage * perPage, categoryTotal)}
              itemLabel="category"
              hrefFor={(p) =>
                settingsHref(rawParams, { tab: "categories", catPage: p > 1 ? p : undefined })
              }
            />
          )}
        </TabsPanel>

        <TabsPanel value="types" className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">Asset types</h2>
              {categoryOptions.length === 0 && (
                <p className="text-sm text-muted-foreground">Add a category first.</p>
              )}
            </div>
            <AssetTypeFormDialog categories={categoryOptions} />
          </div>

          <DebouncedSearchInput
            paramName="typeQ"
            placeholder="Search asset types…"
            ariaLabel="Search asset types"
            resetParams={["typePage"]}
          />

          {types.length === 0 ? (
            <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
              {typeQ ? `No asset types match "${typeQ}".` : "No asset types yet."}
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

          {typeTotal > 0 && (
            <PaginationBar
              total={typeTotal}
              page={typePage}
              totalPages={typeTotalPages}
              rangeStart={(typePage - 1) * perPage + 1}
              rangeEnd={Math.min(typePage * perPage, typeTotal)}
              itemLabel="asset type"
              hrefFor={(p) =>
                settingsHref(rawParams, { tab: "types", typePage: p > 1 ? p : undefined })
              }
            />
          )}
        </TabsPanel>

        <TabsPanel value="products" className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium">Products</h2>
            <ProductFormDialog />
          </div>

          <DebouncedSearchInput
            paramName="prodQ"
            placeholder="Search products…"
            ariaLabel="Search products"
            resetParams={["prodPage"]}
          />

          {products.length === 0 ? (
            <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
              {prodQ ? `No products match "${prodQ}".` : "No products yet."}
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <ul className="divide-y">
                {products.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3 p-3">
                    <div>
                      <span className="text-sm font-medium">{p.name}</span>
                      {p.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
                      )}
                    </div>
                    <ProductFormDialog product={p} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {productTotal > 0 && (
            <PaginationBar
              total={productTotal}
              page={prodPage}
              totalPages={productTotalPages}
              rangeStart={(prodPage - 1) * perPage + 1}
              rangeEnd={Math.min(prodPage * perPage, productTotal)}
              itemLabel="product"
              hrefFor={(p) =>
                settingsHref(rawParams, { tab: "products", prodPage: p > 1 ? p : undefined })
              }
            />
          )}
        </TabsPanel>
      </SettingsTabs>
    </div>
  );
}
