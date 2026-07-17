import { DownloadIcon } from "lucide-react";
import QRCode from "qrcode";

import { buttonVariants } from "@/components/ui/button";

export async function AssetQrBlock({ assetId }: { assetId: string }) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/assets/${assetId}`;
  const [svg, png] = await Promise.all([
    QRCode.toString(url, { type: "svg", margin: 1 }),
    QRCode.toDataURL(url, { margin: 1 }),
  ]);

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-medium text-muted-foreground">QR code</h2>
      <div
        className="w-40 max-w-full [&_svg]:h-auto [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <a href={png} download={`asset-qr-${assetId}.png`} className={buttonVariants({ variant: "outline", size: "sm" })}>
        <DownloadIcon className="size-3.5" />
        Download PNG
      </a>
    </div>
  );
}
