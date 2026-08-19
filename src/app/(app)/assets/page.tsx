import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronsUpDownIcon,
  SettingsIcon,
} from "lucide-react";

import { AssetFormDialog } from "@/components/assets/asset-form-dialog";
import { AssetStatusBadge } from "@/components/assets/asset-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DebouncedSearchInput } from "@/components/ui/debounced-search-input";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { PerPageSelect } from "@/components/ui/per-page-select";
import { SortButton, type SortField } from "@/components/ui/sort-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { PER_PAGE_OPTIONS, DEFAULT_PER_PAGE } from "@/lib/constants/pagination";
import { requireActiveUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Assets" };

type SortDir = "asc" | "desc";

const SORT_COLUMNS: Record<
  string,
  (dir: SortDir) => Prisma.AssetOrderByWithRelationInput
> = {
  assetCode: (dir) => ({ assetCode: dir }),
  name: (dir) => ({ name: dir }),
  category: (dir) => ({ category: { name: dir } }),
  location: (dir) => ({ location: { sort: dir, nulls: "last" } }),
  status: (dir) => ({ status: dir }),
};

const DEFAULT_SORT = "assetCode";
const DEFAULT_DIR: SortDir = "asc";

const SORT_FIELDS: SortField[] = [
  { value: "assetCode", label: "Asset code" },
  { value: "name", label: "Name" },
  { value: "category", label: "Category" },
  { value: "location", label: "Location" },
  { value: "status", label: "Status" },
];

type TableState = {
  q: string;
  category: string;
  perPage: number;
  sort: string;
  dir: SortDir;
};

function assetsHref(state: TableState, page?: number) {
  const search = new URLSearchParams();
  if (state.q) search.set("q", state.q);
  if (state.category) search.set("category", state.category);
  if (state.perPage !== DEFAULT_PER_PAGE) search.set("perPage", String(state.perPage));
  if (state.sort !== DEFAULT_SORT || state.dir !== DEFAULT_DIR) {
    search.set("sort", state.sort);
    if (state.dir === "desc") search.set("dir", "desc");
  }
  if (page && page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `/assets?${query}` : "/assets";
}

function SortableHead({
  column,
  state,
  className,
  children,
}: {
  column: string;
  state: TableState;
  className?: string;
  children: React.ReactNode;
}) {
  const isSorted = state.sort === column;
  const nextDir: SortDir = isSorted && state.dir === "asc" ? "desc" : "asc";
  const Icon = !isSorted ? ChevronsUpDownIcon : state.dir === "asc" ? ArrowUpIcon : ArrowDownIcon;

  return (
    <TableHead
      className={className}
      aria-sort={isSorted ? (state.dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <Link
        href={assetsHref({ ...state, sort: column, dir: nextDir })}
        className={cn(
          "-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 transition-colors hover:text-foreground",
          isSorted && "text-foreground"
        )}
      >
        {children}
        <Icon className={cn("size-3.5", !isSorted && "text-muted-foreground/60")} />
      </Link>
    </TableHead>
  );
}

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    page?: string;
    perPage?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const user = await requireActiveUser();
  const canManage = user.role === "ADMIN" || user.role === "HEAD";
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const category = params.category?.trim() ?? "";
  const perPageParam = Number(params.perPage);
  const perPage = (PER_PAGE_OPTIONS as readonly number[]).includes(perPageParam)
    ? perPageParam
    : DEFAULT_PER_PAGE;
  const sort = params.sort && params.sort in SORT_COLUMNS ? params.sort : DEFAULT_SORT;
  const dir: SortDir = params.dir === "desc" ? "desc" : "asc";
  const state: TableState = { q, category, perPage, sort, dir };

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

  const total = await prisma.asset.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageNumberParam = Math.floor(Number(params.page));
  const page = Math.min(Math.max(pageNumberParam || 1, 1), totalPages);

  const assets = await prisma.asset.findMany({
    where,
    orderBy: [SORT_COLUMNS[sort](dir), { id: "asc" }],
    include: { category: { select: { name: true } } },
    skip: (page - 1) * perPage,
    take: perPage,
  });

  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, total);

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
            <AssetFormDialog
              categories={categories}
              types={types}
              assets={allAssets}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1">
          <Link
            href={assetsHref({ ...state, category: "" })}
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
              href={assetsHref({ ...state, category: c.id })}
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
        <div className="flex items-center gap-2">
          <DebouncedSearchInput
            placeholder="Search asset code, name, category…"
            ariaLabel="Search assets"
            resetParams={["page"]}
          />
          <SortButton fields={SORT_FIELDS} defaultSort={DEFAULT_SORT} defaultDir={DEFAULT_DIR} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
          <TableHeader>
            <TableRow>
              <SortableHead column="assetCode" state={state}>
                Asset code
              </SortableHead>
              <SortableHead column="name" state={state}>
                Name
              </SortableHead>
              <SortableHead column="category" state={state} className="hidden md:table-cell">
                Category
              </SortableHead>
              <SortableHead column="location" state={state} className="hidden md:table-cell">
                Location
              </SortableHead>
              <SortableHead column="status" state={state}>
                Status
              </SortableHead>
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

      <PaginationBar
        total={total}
        page={page}
        totalPages={totalPages}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        itemLabel="asset"
        hrefFor={(p) => assetsHref(state, p)}
        perPageSelect={
          <PerPageSelect options={PER_PAGE_OPTIONS} defaultValue={DEFAULT_PER_PAGE} />
        }
      />
    </div>
  );
}
