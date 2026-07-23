"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

// Human labels for known path segments. Unknown segments (dynamic ids such as
// [ticketId]) fall back to "Details".
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  tickets: "Tickets",
  "production-plans": "Production plans",
  assets: "Assets",
  "knowledge-base": "Knowledge base",
  "pm-checklists": "PM checklists",
  admin: "Admin",
  users: "Users",
  new: "New",
  settings: "Settings",
  approvers: "Approvers",
};

// Segments that are grouping-only and have no index page to link to.
const NON_LINK_SEGMENTS = new Set(["admin"]);

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((seg, i) => {
    const isLast = i === segments.length - 1;
    return {
      href: `/${segments.slice(0, i + 1).join("/")}`,
      label: SEGMENT_LABELS[seg] ?? "Details",
      isLast,
      isLink: !isLast && !NON_LINK_SEGMENTS.has(seg),
    };
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb) => (
          <Fragment key={crumb.href}>
            <BreadcrumbItem>
              {crumb.isLast ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : crumb.isLink ? (
                <BreadcrumbLink render={<Link href={crumb.href} />}>
                  {crumb.label}
                </BreadcrumbLink>
              ) : (
                <span>{crumb.label}</span>
              )}
            </BreadcrumbItem>
            {!crumb.isLast && <BreadcrumbSeparator />}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
