import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireActiveUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const user = await requireActiveUser();
  const isAdmin = user.role === "ADMIN" || user.role === "HEAD";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome, {user.name.split(" ")[0]}
          </h1>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {user.role}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {user.department} · {user.position}
        </p>
      </div>

      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        KPIs and ageing-ticket alerts land in Phase 3 — for now, head
        straight to Tickets.
      </div>

      <div className="flex flex-wrap gap-2">
        <Button render={<Link href="/tickets" />} nativeButton={false}>
          View tickets
        </Button>
        <Button render={<Link href="/tickets/new" />} nativeButton={false} variant="outline">
          Raise a ticket
        </Button>
        {isAdmin && (
          <Button
            render={<Link href="/admin/users" />}
            nativeButton={false}
            variant="outline"
          >
            Manage user accounts
          </Button>
        )}
      </div>
    </div>
  );
}
