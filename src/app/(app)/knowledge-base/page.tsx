import type { Metadata } from "next";

import { ProblemTypeFormDialog } from "@/components/knowledge-base/problem-type-form-dialog";
import { SolutionFormDialog } from "@/components/knowledge-base/solution-form-dialog";
import { DebouncedSearchInput } from "@/components/ui/debounced-search-input";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { PerPageSelect } from "@/components/ui/per-page-select";
import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from "@/lib/constants/pagination";
import { requireActiveUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Knowledge base" };

function kbHref(params: { q?: string; perPage?: number }, page?: number) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.perPage && params.perPage !== DEFAULT_PER_PAGE) {
    search.set("perPage", String(params.perPage));
  }
  if (page && page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `/knowledge-base?${query}` : "/knowledge-base";
}

export default async function KnowledgeBasePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; perPage?: string }>;
}) {
  const user = await requireActiveUser();
  const canManage = user.role === "ADMIN" || user.role === "HEAD";
  const { q: qParam, page: pageParam, perPage: perPageParamRaw } = await searchParams;
  const q = qParam?.trim() ?? "";
  const perPageParam = Number(perPageParamRaw);
  const perPage = (PER_PAGE_OPTIONS as readonly number[]).includes(perPageParam)
    ? perPageParam
    : DEFAULT_PER_PAGE;

  const where: Prisma.ProblemTypeWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { category: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          {
            solutions: {
              some: {
                OR: [
                  { title: { contains: q, mode: "insensitive" } },
                  { description: { contains: q, mode: "insensitive" } },
                  { asset: { assetCode: { contains: q, mode: "insensitive" } } },
                  { asset: { name: { contains: q, mode: "insensitive" } } },
                ],
              },
            },
          },
        ],
      }
    : {};

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      orderBy: { assetCode: "asc" },
      select: { id: true, assetCode: true, name: true },
    }),
    prisma.problemType.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const pageNumberParam = Math.floor(Number(pageParam));
  const page = Math.min(Math.max(pageNumberParam || 1, 1), totalPages);

  const problemTypes = await prisma.problemType.findMany({
    where,
    orderBy: { name: "asc" },
    skip: (page - 1) * perPage,
    take: perPage,
    include: {
      solutions: {
        orderBy: { createdAt: "desc" },
        include: { asset: { select: { assetCode: true, name: true } } },
      },
    },
  });

  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, total);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Knowledge base
          </h1>
          <p className="text-sm text-muted-foreground">
            Problem types and the curated fixes technicians and requesters
            see for them.
          </p>
        </div>
        {canManage && <ProblemTypeFormDialog />}
      </div>

      <DebouncedSearchInput
        placeholder="Search problem types, solutions, assets…"
        ariaLabel="Search knowledge base"
        resetParams={["page"]}
        className="sm:max-w-sm"
      />

      {problemTypes.length === 0 && (
        <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
          {q ? `No problem types match "${q}".` : "No problem types yet."}
        </p>
      )}

      <div className="space-y-4">
        {problemTypes.map((pt) => (
          <div key={pt.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-medium">{pt.name}</h2>
                  {pt.category && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {pt.category}
                    </span>
                  )}
                </div>
                {pt.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {pt.description}
                  </p>
                )}
              </div>
              {canManage && (
                <div className="flex items-center gap-1">
                  <SolutionFormDialog problemTypeId={pt.id} assets={assets} />
                  <ProblemTypeFormDialog problemType={pt} />
                </div>
              )}
            </div>

            {pt.solutions.length > 0 && (
              <ul className="mt-3 space-y-2 border-t pt-3">
                {pt.solutions.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-start justify-between gap-3 rounded-md bg-muted/30 p-2.5"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {s.title}
                        {s.asset && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {s.asset.assetCode}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {s.description}
                      </p>
                    </div>
                    {canManage && (
                      <SolutionFormDialog
                        problemTypeId={pt.id}
                        assets={assets}
                        solution={s}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {total > 0 && (
        <PaginationBar
          total={total}
          page={page}
          totalPages={totalPages}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          itemLabel="problem type"
          hrefFor={(p) => kbHref({ q, perPage }, p)}
          perPageSelect={
            <PerPageSelect options={PER_PAGE_OPTIONS} defaultValue={DEFAULT_PER_PAGE} />
          }
        />
      )}
    </div>
  );
}
