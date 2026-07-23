import type { Metadata } from "next";

import { PmChecklistItemDialog } from "@/components/pm-checklists/pm-checklist-item-dialog";
import { PmChecklistTemplateDialog } from "@/components/pm-checklists/pm-checklist-template-dialog";
import { DebouncedSearchInput } from "@/components/ui/debounced-search-input";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { PerPageSelect } from "@/components/ui/per-page-select";
import type { Prisma } from "@/generated/prisma/client";
import { DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from "@/lib/constants/pagination";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "PM checklists" };

function href(params: { q?: string; perPage?: number }, page?: number) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.perPage && params.perPage !== DEFAULT_PER_PAGE) {
    search.set("perPage", String(params.perPage));
  }
  if (page && page > 1) search.set("page", String(page));
  const query = search.toString();
  return query ? `/pm-checklists?${query}` : "/pm-checklists";
}

export default async function PmChecklistsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; perPage?: string }>;
}) {
  // Maintenance Head/Supervisor prepare these (ADMIN too).
  await requireRole("ADMIN", "HEAD", "SUPERVISOR");
  const { q: qParam, page: pageParam, perPage: perPageParamRaw } = await searchParams;
  const q = qParam?.trim() ?? "";
  const perPageParam = Number(perPageParamRaw);
  const perPage = (PER_PAGE_OPTIONS as readonly number[]).includes(perPageParam)
    ? perPageParam
    : DEFAULT_PER_PAGE;

  const where: Prisma.PmChecklistTemplateWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { items: { some: { label: { contains: q, mode: "insensitive" } } } },
        ],
      }
    : {};

  const total = await prisma.pmChecklistTemplate.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(Math.floor(Number(pageParam)) || 1, 1), totalPages);

  const templates = await prisma.pmChecklistTemplate.findMany({
    where,
    orderBy: { name: "asc" },
    skip: (page - 1) * perPage,
    take: perPage,
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  const rangeStart = total === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeEnd = Math.min(page * perPage, total);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">PM checklists</h1>
          <p className="text-sm text-muted-foreground">
            Reusable preventive-maintenance task lists. Attach one to a machine
            as its default — it&apos;s snapshotted onto each new PM ticket.
          </p>
        </div>
        <PmChecklistTemplateDialog />
      </div>

      <DebouncedSearchInput
        placeholder="Search checklists and tasks…"
        ariaLabel="Search PM checklists"
        resetParams={["page"]}
        className="sm:max-w-sm"
      />

      {templates.length === 0 && (
        <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
          {q ? `No checklists match "${q}".` : "No checklists yet."}
        </p>
      )}

      <div className="space-y-4">
        {templates.map((t) => (
          <div key={t.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-medium">{t.name}</h2>
                {t.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <PmChecklistItemDialog templateId={t.id} />
                <PmChecklistTemplateDialog template={t} />
              </div>
            </div>

            {t.items.length > 0 ? (
              <ol className="mt-3 space-y-1.5 border-t pt-3">
                {t.items.map((it, i) => (
                  <li
                    key={it.id}
                    className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-2.5 py-1.5 text-sm"
                  >
                    <span>
                      <span className="mr-2 text-xs text-muted-foreground tabular-nums">
                        {i + 1}.
                      </span>
                      {it.label}
                    </span>
                    <PmChecklistItemDialog templateId={t.id} item={it} />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                No tasks yet — add the first one.
              </p>
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
          itemLabel="checklist"
          hrefFor={(p) => href({ q, perPage }, p)}
          perPageSelect={
            <PerPageSelect options={PER_PAGE_OPTIONS} defaultValue={DEFAULT_PER_PAGE} />
          }
        />
      )}
    </div>
  );
}
