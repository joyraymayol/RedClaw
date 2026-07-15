import type { Metadata } from "next";

import { ProblemTypeFormDialog } from "@/components/knowledge-base/problem-type-form-dialog";
import { SolutionFormDialog } from "@/components/knowledge-base/solution-form-dialog";
import { requireActiveUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Knowledge base" };

export default async function KnowledgeBasePage() {
  const user = await requireActiveUser();
  const canManage = user.role === "ADMIN" || user.role === "HEAD";

  const [problemTypes, machines] = await Promise.all([
    prisma.problemType.findMany({
      orderBy: { name: "asc" },
      include: {
        solutions: {
          orderBy: { createdAt: "desc" },
          include: { machine: { select: { assetCode: true, name: true } } },
        },
      },
    }),
    prisma.machine.findMany({
      orderBy: { assetCode: "asc" },
      select: { id: true, assetCode: true, name: true },
    }),
  ]);

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

      {problemTypes.length === 0 && (
        <p className="rounded-lg border py-10 text-center text-sm text-muted-foreground">
          No problem types yet.
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
                  <SolutionFormDialog problemTypeId={pt.id} machines={machines} />
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
                        {s.machine && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {s.machine.assetCode}
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
                        machines={machines}
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
    </div>
  );
}
