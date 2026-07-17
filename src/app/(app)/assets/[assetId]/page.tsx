import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AssetFormDialog } from "@/components/assets/asset-form-dialog";
import { AssetQrBlock } from "@/components/assets/asset-qr-block";
import { AssetRetireButton } from "@/components/assets/asset-retire-button";
import { AssetStatusBadge } from "@/components/assets/asset-status-badge";
import { TicketPriorityBadge } from "@/components/tickets/ticket-priority-badge";
import { TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireActiveUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

function formatDate(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
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
}: {
  params: Promise<{ assetId: string }>;
}) {
  const user = await requireActiveUser();
  const canManage = user.role === "ADMIN" || user.role === "HEAD";
  const { assetId } = await params;

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: {
      category: { select: { name: true } },
      type: { select: { name: true } },
      parentAsset: { select: { id: true, assetCode: true, name: true } },
      childAssets: {
        orderBy: { assetCode: "asc" },
        select: { id: true, assetCode: true, name: true, status: true },
      },
      tickets: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          ticketNumber: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
        },
      },
    },
  });
  if (!asset) notFound();

  const [categories, types, allAssets] = canManage
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
      ])
    : [[], [], []];

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
            <AssetFormDialog asset={asset} categories={categories} types={types} assets={allAssets} />
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

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Tickets on this asset
        </h2>
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
              {asset.tickets.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No tickets raised on this asset yet.
                  </TableCell>
                </TableRow>
              )}
              {asset.tickets.map((t) => (
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
                    {t.createdAt.toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
