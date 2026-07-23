"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { UserRole } from "@/generated/prisma/enums";
import { NAV_LINKS } from "@/components/layout/nav-links";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

function initials(name?: string | null) {
  if (!name) return "RC";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "RC";
}

function roleLabel(role: UserRole | null) {
  if (!role) return "Member";
  return role.charAt(0) + role.slice(1).toLowerCase();
}

export function AppSidebar({
  role,
  userName,
}: {
  role: UserRole | null;
  userName?: string | null;
}) {
  const pathname = usePathname();
  const links = NAV_LINKS.filter((l) => !l.roles || (role && l.roles.includes(role)));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Identity block — collapses to just the avatar in icon mode. */}
            <SidebarMenuButton
              size="lg"
              className="cursor-default hover:bg-transparent active:bg-transparent"
            >
              <span className="flex aspect-square size-8 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
                {initials(userName)}
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate font-medium">{userName ?? "RedClaw"}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {roleLabel(role)}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {links.map((l) => {
                const isActive =
                  pathname === l.href || pathname.startsWith(`${l.href}/`);
                const Icon = l.icon;
                return (
                  <SidebarMenuItem key={l.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={l.label}
                      render={<Link href={l.href} />}
                    >
                      <Icon />
                      <span>{l.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
