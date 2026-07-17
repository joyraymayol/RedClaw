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
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Raise a ticket" };

export default async function NewTicketPage() {
  await requireActiveUser();

  const [categories, assets, problemTypes, solutions] = await Promise.all([
    prisma.assetCategory.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.asset.findMany({
      where: { status: { not: "RETIRED" } },
      orderBy: { assetCode: "asc" },
      select: { id: true, assetCode: true, name: true, categoryId: true },
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
            assets={assets}
            problemTypes={problemTypes}
            solutions={solutions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
