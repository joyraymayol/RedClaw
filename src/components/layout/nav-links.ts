import {
  BookOpen,
  Boxes,
  CalendarRange,
  ClipboardCheck,
  LayoutDashboard,
  PillBottle,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { UserRole } from "@/generated/prisma/enums";

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: UserRole[];
};

export const NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/production-plans", label: "Production plans", icon: CalendarRange },
  { href: "/assets", label: "Assets", icon: Boxes },
  { href: "/products", label: "Products", icon: PillBottle },
  { href: "/knowledge-base", label: "Knowledge base", icon: BookOpen },
  {
    href: "/pm-checklists",
    label: "PM checklists",
    icon: ClipboardCheck,
    roles: ["ADMIN", "HEAD", "SUPERVISOR"],
  },
  { href: "/admin/users", label: "Users", icon: Users, roles: ["ADMIN", "HEAD"] },
];
