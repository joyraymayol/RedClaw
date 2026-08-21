import Link from "next/link";
import { MapPinIcon } from "lucide-react";

import { AssetStatusBadge } from "@/components/assets/asset-status-badge";
import type { AssetStatus } from "@/generated/prisma/enums";

export function AssetListCard({
  asset,
}: {
  asset: {
    id: string;
    assetCode: string;
    name: string;
    status: AssetStatus;
    category: { name: string };
    location: string | null;
  };
}) {
  return (
    <Link
      href={`/assets/${asset.id}`}
      className="flex flex-col gap-1.5 rounded-lg border bg-card px-4 py-3 shadow-xs transition-colors active:bg-muted/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-muted-foreground">{asset.assetCode}</span>
        <AssetStatusBadge status={asset.status} />
      </div>
      <p className="truncate font-medium">{asset.name}</p>
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span className="truncate">{asset.category.name}</span>
        {asset.location && (
          <span className="flex min-w-0 shrink-0 items-center gap-1 truncate">
            <MapPinIcon className="size-3.5 shrink-0" />
            <span className="truncate">{asset.location}</span>
          </span>
        )}
      </div>
    </Link>
  );
}
