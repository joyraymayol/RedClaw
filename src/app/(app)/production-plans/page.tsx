import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, UsersIcon } from "lucide-react";

import { ProductionPlanStatusBadge } from "@/components/production-plans/production-plan-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DebouncedSearchInput } from "@/components/ui/debounced-search-input";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { PerPageSelect } from "@/components/ui/per-page-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from "@/lib/constants/pagination";
import { requireActiveUser } from "@/lib/auth";
import { canPreparePlan } from "@/lib/authz";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Production plans" };

function href(params: { q?: string; perPage?: number }, page?: number) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.perPage && params.perPage !== DEFAULT_PER_PAGE) {
    search.set("perPage", String(params.perPage));
  }
  if (page && page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `/production-plans?${query}` : "/production-plans";
}

export default async function ProductionPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; perPage?: string }>;
}) {
  const user = await requireActiveUser();
  const { q: qParam, page: pageParam, perPage: perPageParamRaw } = await searchParams;
  const q = qParam?.trim() ?? "";
  const perPageParam = Number(perPageParamRaw);
  const perPage = (PER_PAGE_OPTIONS as readonly number[]).includes(perPageParam)
    ? perPageParam
    : DEFAULT_PER_PAGE;

  const canPrepare = canPreparePlan(user);
  const canManageApprovers = user.role === "ADMIN" || user.role === "HEAD";
  const isApprover = !!(await prisma.productionPlanApprover.findUnique({
    where: { userId: user.id },
    select: { userId: true },
  }));

  // Preparers (Production/ADMIN) and HEAD see every plan; designated approvers
  // additionally see pending ones; everyone else sees only approved plans.
  const seesAll = canPrepare || user.role === "HEAD";
  const statusScope: Prisma.ProductionPlanWhereInput = seesAll
    ? {}
    : isApprover
      ? { status: { in: ["PENDING_APPROVAL", "APPROVED"] } }
      : { status: "APPROVED" };

  const where: Prisma.ProductionPlanWhereInput = {
    ...statusScope,
    ...(q && { formNumber: { contains: q, mode: "insensitive" } }),
  };

  const total = await prisma.productionPlan.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(Math.floor(Number(pageParam)) || 1, 1), totalPages);

  const plans = await prisma.productionPlan.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * perPage,
    take: perPage,
    select: {
      id: true,
      formNumber: true,
      scheduleFrom: true,
      scheduleTo: true,
      effectiveDate: true,
      status: true,
      preparedBy: { select: { name: true } },
      _count: { select: { rows: true } },
    },
  });

  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, total);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Production plans</h1>
          <p className="text-sm text-muted-foreground">
            Weekly machine schedules prepared by Production and approved for
            Maintenance to action.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManageApprovers && (
            <Button
              variant="outline"
              render={<Link href="/production-plans/approvers" />}
              nativeButton={false}
            >
              <UsersIcon className="size-4" />
              Approvers
            </Button>
          )}
          {canPrepare && (
            <Button render={<Link href="/production-plans/new" />} nativeButton={false}>
              <PlusIcon className="size-4" />
              Prepare a plan
            </Button>
          )}
        </div>
      </div>

      <DebouncedSearchInput
        placeholder="Search form number…"
        ariaLabel="Search production plans"
        resetParams={["page"]}
        className="sm:max-w-sm"
      />

      <div className="overflow-x-auto rounded-lg border">
        <Table className="[&_td]:px-4 [&_td]:py-3 [&_th]:px-4">
          <TableHeader>
            <TableRow>
              <TableHead>Form no.</TableHead>
              <TableHead className="hidden md:table-cell">Schedule</TableHead>
              <TableHead className="hidden lg:table-cell">Effective</TableHead>
              <TableHead>Machines</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Prepared by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {q ? `No plans match "${q}".` : "No production plans yet."}
                </TableCell>
              </TableRow>
            )}
            {plans.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link
                    href={`/production-plans/${p.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "xs" }), "font-mono")}
                  >
                    {p.formNumber}
                  </Link>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {formatDate(p.scheduleFrom)} – {formatDate(p.scheduleTo)}
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {formatDate(p.effectiveDate)}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {p._count.rows}
                </TableCell>
                <TableCell>
                  <ProductionPlanStatusBadge status={p.status} />
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">
                  {p.preparedBy.name}
                </TableCell>
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
        itemLabel="plan"
        hrefFor={(p) => href({ q, perPage }, p)}
        perPageSelect={
          <PerPageSelect options={PER_PAGE_OPTIONS} defaultValue={DEFAULT_PER_PAGE} />
        }
      />
    </div>
  );
}
