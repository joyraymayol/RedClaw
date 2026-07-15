"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { UserRole } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const LINKS: { href: string; label: string; roles?: UserRole[] }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tickets", label: "Tickets" },
  { href: "/machines", label: "Machines" },
  { href: "/knowledge-base", label: "Knowledge base" },
  { href: "/admin/users", label: "Users", roles: ["ADMIN", "HEAD"] },
];

export function AppNav({ role }: { role: UserRole | null }) {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {LINKS.filter((l) => !l.roles || (role && l.roles.includes(role))).map((l) => {
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
