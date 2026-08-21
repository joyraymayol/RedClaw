import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react";

import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { ProductListCard } from "@/components/products/product-list-card";
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

export const metadata: Metadata = { title: "Products" };

type SortDir = "asc" | "desc";

const SORT_COLUMNS: Record<
  string,
  (dir: SortDir) => Prisma.ProductOrderByWithRelationInput
> = {
  name: (dir) => ({ name: dir }),
};

const DEFAULT_SORT = "name";
const DEFAULT_DIR: SortDir = "asc";

const SORT_FIELDS: SortField[] = [{ value: "name", label: "Name" }];

type TableState = {
  q: string;
  perPage: number;
  sort: string;
  dir: SortDir;
};

function productsHref(state: TableState, page?: number) {
  const search = new URLSearchParams();
  if (state.q) search.set("q", state.q);
  if (state.perPage !== DEFAULT_PER_PAGE) search.set("perPage", String(state.perPage));
  if (state.sort !== DEFAULT_SORT || state.dir !== DEFAULT_DIR) {
    search.set("sort", state.sort);
    if (state.dir === "desc") search.set("dir", "desc");
  }
  if (page && page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `/products?${query}` : "/products";
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
        href={productsHref({ ...state, sort: column, dir: nextDir })}
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

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
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
  const perPageParam = Number(params.perPage);
  const perPage = (PER_PAGE_OPTIONS as readonly number[]).includes(perPageParam)
    ? perPageParam
    : DEFAULT_PER_PAGE;
  const sort = params.sort && params.sort in SORT_COLUMNS ? params.sort : DEFAULT_SORT;
  const dir: SortDir = params.dir === "desc" ? "desc" : "asc";
  const state: TableState = { q, perPage, sort, dir };

  const where: Prisma.ProductWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const total = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageNumberParam = Math.floor(Number(params.page));
  const page = Math.min(Math.max(pageNumberParam || 1, 1), totalPages);

  const products = await prisma.product.findMany({
    where,
    orderBy: [SORT_COLUMNS[sort](dir), { id: "asc" }],
    skip: (page - 1) * perPage,
    take: perPage,
  });

  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, total);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            Manage and view the plastic products manufactured by your production machines.
          </p>
        </div>
        {canManage && <ProductFormDialog />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DebouncedSearchInput
          placeholder="Search products…"
          ariaLabel="Search products"
          resetParams={["page"]}
          className="w-56 sm:w-72"
        />
        <SortButton fields={SORT_FIELDS} defaultSort={DEFAULT_SORT} defaultDir={DEFAULT_DIR} />
      </div>

      {/* Mobile: card list */}
      <div className="space-y-3 md:hidden">
        {products.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {q ? `No products match "${q}".` : "No products yet."}
          </p>
        )}
        {products.map((p) => (
          <ProductListCard key={p.id} product={p} canManage={canManage} />
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block">
        <div className="overflow-x-auto rounded-lg border">
          <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
            <TableHeader>
              <TableRow>
                <SortableHead column="name" state={state}>
                  Name
                </SortableHead>
                <TableHead>Description</TableHead>
                {canManage && <TableHead className="text-right">Edit</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={canManage ? 3 : 2}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    {q ? `No products match "${q}".` : "No products yet."}
                  </TableCell>
                </TableRow>
              )}
              {products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-muted-foreground">{p.description ?? "—"}</TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <ProductFormDialog product={p} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <PaginationBar
        total={total}
        page={page}
        totalPages={totalPages}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        itemLabel="product"
        hrefFor={(p) => productsHref(state, p)}
        perPageSelect={<PerPageSelect options={PER_PAGE_OPTIONS} defaultValue={DEFAULT_PER_PAGE} />}
      />
    </div>
  );
}
