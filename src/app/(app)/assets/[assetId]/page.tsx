import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AssetChecklistsCard } from "@/components/assets/asset-checklists-card";
import { AssetFormDialog } from "@/components/assets/asset-form-dialog";
import { AssetProductsCard } from "@/components/assets/asset-products-card";
import { AssetQrBlock } from "@/components/assets/asset-qr-block";
import { AssetRetireButton } from "@/components/assets/asset-retire-button";
import { AssetStatusBadge } from "@/components/assets/asset-status-badge";
import { TableSkeleton } from "@/components/skeletons/table-skeleton";
import { TicketPriorityBadge } from "@/components/tickets/ticket-priority-badge";
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { DebouncedSearchInput } from "@/components/ui/debounced-search-input";
import { ListNavPending, ListNavProvider } from "@/components/ui/list-nav-context";
import { PaginationBar } from "@/components/ui/pagination-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_PER_PAGE } from "@/lib/constants/pagination";
import { requireActiveUser } from "@/lib/auth";
import { createdAtRange, parseDayParam } from "@/lib/date-range";
import { formatDate as formatDateTimeOnly, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

function formatDate(d: Date | null) {
  if (!d) return "—";
  return formatDateTimeOnly(d);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ assetId: string }>;
}): Promise<Metadata> {
  const { assetId } = await params;
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { assetCode: true, name: true },
  });
  return { title: asset ? `${asset.assetCode} · ${asset.name}` : "Asset" };
}

export default async function AssetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ assetId: string }>;
  searchParams: Promise<{ tQ?: string; tFrom?: string; tTo?: string; tPage?: string }>;
}) {
  const user = await requireActiveUser();
  const canManage = user.role === "ADMIN" || user.role === "HEAD";
  const { assetId } = await params;
  const sp = await searchParams;

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      category: { select: { name: true, tracksProducts: true } },
      type: { select: { name: true } },
      parentAsset: { select: { id: true, assetCode: true, name: true } },
      childAssets: {
        orderBy: { assetCode: "asc" },
        select: { id: true, assetCode: true, name: true, status: true },
      },
      currentProduct: { select: { id: true, name: true } },
      productCapabilities: {
        orderBy: { addedAt: "asc" },
        select: { product: { select: { id: true, name: true } } },
      },
      checklistAssignments: {
        orderBy: { addedAt: "asc" },
        select: { template: { select: { id: true, name: true } } },
      },
      productChanges: {
        orderBy: { changedAt: "desc" },
        take: 20,
        select: {
          id: true,
          changedAt: true,
          product: { select: { name: true } },
          changedBy: { select: { name: true } },
        },
      },
    },
  });
  if (!asset) notFound();

  // Ever-flagged, not just currently-flagged — a past flag (since removed
  // by a re-flag) is still part of this asset's maintenance history.
  const tQ = (sp.tQ ?? "").trim();
  const tFromDate = parseDayParam(sp.tFrom);
  const tToDate = parseDayParam(sp.tTo);
  const tFrom = tFromDate ? sp.tFrom!.trim() : "";
  const tTo = tToDate ? sp.tTo!.trim() : "";
  const ticketCreatedAt = createdAtRange(tFromDate, tToDate);

  const ticketWhere: Prisma.TicketWhereInput = {
    assets: { some: { assetId } },
    ...(ticketCreatedAt && { createdAt: ticketCreatedAt }),
    ...(tQ && {
      OR: [
        { ticketNumber: { contains: tQ, mode: "insensitive" } },
        { title: { contains: tQ, mode: "insensitive" } },
      ],
    }),
  };

  const ticketTotal = await prisma.ticket.count({ where: ticketWhere });
  const ticketTotalPages = Math.max(1, Math.ceil(ticketTotal / DEFAULT_PER_PAGE));
  const ticketPage = Math.min(Math.max(Math.floor(Number(sp.tPage)) || 1, 1), ticketTotalPages);

  const tickets = await prisma.ticket.findMany({
    where: ticketWhere,
    orderBy: { createdAt: "desc" },
    skip: (ticketPage - 1) * DEFAULT_PER_PAGE,
    take: DEFAULT_PER_PAGE,
    select: {
      id: true,
      ticketNumber: true,
      title: true,
      status: true,
      priority: true,
      createdAt: true,
    },
  });

  const ticketRangeStart = ticketTotal === 0 ? 0 : (ticketPage - 1) * DEFAULT_PER_PAGE + 1;
  const ticketRangeEnd = Math.min(ticketPage * DEFAULT_PER_PAGE, ticketTotal);

  function ticketsHref(page: number) {
    const p = new URLSearchParams();
    if (tQ) p.set("tQ", tQ);
    if (tFrom) p.set("tFrom", tFrom);
    if (tTo) p.set("tTo", tTo);
    if (page > 1) p.set("tPage", String(page));
    const query = p.toString();
    return query ? `/assets/${assetId}?${query}` : `/assets/${assetId}`;
  }

  const [categories, types, allAssets, allProducts, allChecklistTemplates] = canManage
    ? await Promise.all([
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
        prisma.product.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
        prisma.pmChecklistTemplate.findMany({
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        }),
      ])
    : [[], [], [], [], []];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-xs text-muted-foreground">
            {asset.assetCode}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {asset.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
            <AssetStatusBadge status={asset.status} />
            <span>{asset.category.name}</span>
            {asset.location && <span>· {asset.location}</span>}
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <AssetRetireButton
              assetId={asset.id}
              assetName={asset.name}
              retired={asset.status === "RETIRED"}
            />
            <AssetFormDialog
              asset={asset}
              categories={categories}
              types={types}
              assets={allAssets}
            />
          </div>
        )}
      </div>

      {asset.notes && (
        <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
          {asset.notes}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-lg border p-4">
          <h2 className="text-sm font-medium text-muted-foreground">Details</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Type</dt>
            <dd>{asset.type?.name ?? "—"}</dd>
            <dt className="text-muted-foreground">Serial number</dt>
            <dd>{asset.serialNumber ?? "—"}</dd>
            <dt className="text-muted-foreground">Manufacturer</dt>
            <dd>{asset.manufacturer ?? "—"}</dd>
            <dt className="text-muted-foreground">Model</dt>
            <dd>{asset.model ?? "—"}</dd>
            <dt className="text-muted-foreground">Purchased</dt>
            <dd>{formatDate(asset.purchaseDate)}</dd>
            <dt className="text-muted-foreground">Installed</dt>
            <dd>{formatDate(asset.installedAt)}</dd>
            <dt className="text-muted-foreground">Commissioned</dt>
            <dd>{formatDate(asset.commissionedAt)}</dd>
            <dt className="text-muted-foreground">Warranty expires</dt>
            <dd>{formatDate(asset.warrantyExpiresAt)}</dd>
            {asset.parentAsset && (
              <>
                <dt className="text-muted-foreground">Parent asset</dt>
                <dd>
                  <Link
                    href={`/assets/${asset.parentAsset.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "xs" }), "font-mono")}
                  >
                    {asset.parentAsset.assetCode}
                  </Link>
                </dd>
              </>
            )}
            {asset.status === "RETIRED" && (
              <>
                <dt className="text-muted-foreground">Retired</dt>
                <dd>{formatDate(asset.retiredAt)}</dd>
              </>
            )}
          </dl>
        </div>

        <AssetQrBlock assetId={asset.id} />
      </div>

      {asset.category.tracksProducts && (
        <AssetProductsCard
          assetId={asset.id}
          retired={asset.status === "RETIRED"}
          canManage={canManage}
          allProducts={allProducts}
          capabilities={asset.productCapabilities.map((c) => c.product)}
          currentProductId={asset.currentProduct?.id ?? null}
          currentProductName={asset.currentProduct?.name ?? null}
          changeLogs={asset.productChanges.map((log) => ({
            id: log.id,
            productName: log.product?.name ?? null,
            changedByName: log.changedBy.name,
            changedAt: log.changedAt,
          }))}
        />
      )}

      <AssetChecklistsCard
        assetId={asset.id}
        canManage={canManage}
        allTemplates={allChecklistTemplates}
        templates={asset.checklistAssignments.map((a) => a.template)}
      />

      {asset.childAssets.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Children</h2>
          <div className="flex flex-wrap gap-2">
            {asset.childAssets.map((c) => (
              <Link
                key={c.id}
                href={`/assets/${c.id}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "font-mono")}
              >
                {c.assetCode} — {c.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <ListNavProvider className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Tickets on this asset
          </h2>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <DateRangeFilter
              label="Raised date"
              fromParam="tFrom"
              toParam="tTo"
              resetParams={["tPage"]}
            />
            <DebouncedSearchInput
              paramName="tQ"
              placeholder="Search ticket #, title…"
              ariaLabel="Search this asset's tickets"
              resetParams={["tPage"]}
            />
          </div>
        </div>

        <ListNavPending fallback={<TableSkeleton columns={5} rows={Math.min(DEFAULT_PER_PAGE, 6)} />}>
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border">
              <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Raised</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-10 text-center text-sm text-muted-foreground"
                      >
                        {tQ || tFrom || tTo
                          ? "No tickets match those filters."
                          : "No tickets raised on this asset yet."}
                      </TableCell>
                    </TableRow>
                  )}
                  {tickets.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Link
                          href={`/tickets/${t.id}`}
                          className={cn(buttonVariants({ variant: "outline", size: "xs" }), "font-mono")}
                        >
                          {t.ticketNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{t.title}</TableCell>
                      <TableCell>
                        <TicketPriorityBadge priority={t.priority} />
                      </TableCell>
                      <TableCell>
                        <TicketStatusBadge status={t.status} />
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {formatDateTime(t.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {ticketTotal > 0 && (
              <PaginationBar
                total={ticketTotal}
                page={ticketPage}
                totalPages={ticketTotalPages}
                rangeStart={ticketRangeStart}
                rangeEnd={ticketRangeEnd}
                itemLabel="ticket"
                hrefFor={ticketsHref}
              />
            )}
          </div>
        </ListNavPending>
      </ListNavProvider>
    </div>
  );
}
