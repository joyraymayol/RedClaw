import type { UserRole } from "@/generated/prisma/enums";

export type NavLink = { href: string; label: string; roles?: UserRole[] };

export const NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tickets", label: "Tickets" },
  { href: "/machines", label: "Machines" },
  { href: "/knowledge-base", label: "Knowledge base" },
  { href: "/admin/users", label: "Users", roles: ["ADMIN", "HEAD"] },
];
