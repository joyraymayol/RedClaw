import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TicketForm } from "@/components/tickets/ticket-form";
import { requireActiveUser } from "@/lib/auth";
import { canCreateTicketType } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import type { TicketType } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Raise a ticket" };

const ALL_TICKET_TYPES: TicketType[] = [
  "MAINTENANCE",
  "PREVENTIVE_MAINTENANCE",
  "MACHINE_SETUP",
];

export default async function NewTicketPage() {
  const user = await requireActiveUser();
  const allowedTypes = ALL_TICKET_TYPES.filter(
    (t) => canCreateTicketType(user, t).allowed
  );

  const [categories, assets, problemTypes, solutions] = await Promise.all([
    prisma.assetCategory.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.asset.findMany({
      where: { status: { not: "RETIRED" } },
      orderBy: { assetCode: "asc" },
      select: {
        id: true,
        assetCode: true,
        name: true,
        categoryId: true,
        productCapabilities: {
          orderBy: { addedAt: "asc" },
          select: { product: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.problemType.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.solution.findMany({
      select: {
        id: true,
        title: true,
        description: true,
        problemTypeId: true,
        assetId: true,
      },
    }),
  ]);

  const assetOptions = assets.map(({ id, assetCode, name, categoryId }) => ({
    id,
    assetCode,
    name,
    categoryId,
  }));
  const productsByAsset: Record<string, { id: string; name: string }[]> = Object.fromEntries(
    assets.map((a) => [a.id, a.productCapabilities.map((c) => c.product)])
  );

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Raise a maintenance ticket</CardTitle>
          <CardDescription>
            Describe the problem — a technician will pick it up from here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TicketForm
            categories={categories}
            assets={assetOptions}
            problemTypes={problemTypes}
            solutions={solutions}
            allowedTypes={allowedTypes}
            productsByAsset={productsByAsset}
          />
        </CardContent>
      </Card>
    </div>
  );
}
