import type { Metadata } from "next";
import Link from "next/link";
import { SettingsIcon } from "lucide-react";

import { AssetFormDialog } from "@/components/assets/asset-form-dialog";
import { AssetsSearch } from "@/components/assets/assets-search";
import { AssetStatusBadge } from "@/components/assets/asset-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { requireActiveUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Assets" };

function assetsHref(params: { q?: string; category?: string }) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  const query = search.toString();
  return query ? `/assets?${query}` : "/assets";
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const user = await requireActiveUser();
  const canManage = user.role === "ADMIN" || user.role === "HEAD";
  const { q: qParam, category: categoryParam } = await searchParams;
  const q = qParam?.trim() ?? "";
  const category = categoryParam?.trim() ?? "";

  const [categories, types, allAssets] = await Promise.all([
    prisma.assetCategory.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, supportsParentAsset: true },
    }),
    prisma.assetType.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, categoryId: true },
    }),
    prisma.asset.findMany({
      orderBy: { assetCode: "asc" },
      select: { id: true, assetCode: true, name: true, categoryId: true, status: true },
    }),
  ]);

  const where: Prisma.AssetWhereInput = {
    ...(category && { categoryId: category }),
    ...(q && {
      OR: [
        { assetCode: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { category: { name: { contains: q, mode: "insensitive" } } },
        { location: { contains: q, mode: "insensitive" } },
        { serialNumber: { contains: q, mode: "insensitive" } },
        { manufacturer: { contains: q, mode: "insensitive" } },
        { model: { contains: q, mode: "insensitive" } },
      ],
    }),
  };

  const assets = await prisma.asset.findMany({
    where,
    orderBy: { assetCode: "asc" },
    include: { category: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
          <p className="text-sm text-muted-foreground">
            Assets tickets can be raised against.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button
              variant="outline"
              render={<Link href="/assets/settings" />}
              nativeButton={false}
            >
              <SettingsIcon className="size-4" />
              Manage settings
            </Button>
          )}
          {canManage && (
            <AssetFormDialog categories={categories} types={types} assets={allAssets} />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1">
          <Link
            href={assetsHref({ q })}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm transition-colors",
              !category
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.id}
              href={assetsHref({ q, category: c.id })}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-sm transition-colors",
                category === c.id
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {c.name}
            </Link>
          ))}
        </div>
        <AssetsSearch />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
          <TableHeader>
            <TableRow>
              <TableHead>Asset code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Category</TableHead>
              <TableHead className="hidden md:table-cell">Location</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead className="text-right">Edit</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 6 : 5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {q ? `No assets match "${q}".` : "No assets yet."}
                </TableCell>
              </TableRow>
            )}
            {assets.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Link
                    href={`/assets/${a.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "xs" }), "font-mono")}
                  >
                    {a.assetCode}
                  </Link>
                </TableCell>
                <TableCell>{a.name}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {a.category.name}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {a.location ?? "—"}
                </TableCell>
                <TableCell>
                  <AssetStatusBadge status={a.status} />
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <AssetFormDialog
                      asset={a}
                      categories={categories}
                      types={types}
                      assets={allAssets}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
