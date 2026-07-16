"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { UserRole } from "@/generated/prisma/enums";
import { NAV_LINKS } from "@/components/layout/nav-links";
import { cn } from "@/lib/utils";

export function AppNav({ role }: { role: UserRole | null }) {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {NAV_LINKS.filter((l) => !l.roles || (role && l.roles.includes(role))).map((l) => {
        const isActive = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm transition-colors",
              isActive
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
