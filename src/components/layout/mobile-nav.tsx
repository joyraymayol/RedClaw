"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import type { UserRole } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NAV_LINKS } from "@/components/layout/nav-links";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { cn } from "@/lib/utils";

export function MobileNav({
  role,
  userName,
}: {
  role: UserRole | null;
  userName?: string | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="Open menu" />
        }
      >
        <Menu className="size-4.5" />
      </SheetTrigger>
      <SheetContent side="left" className="flex flex-col gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
          {NAV_LINKS.filter((l) => !l.roles || (role && l.roles.includes(role))).map((l) => {
            const isActive = pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-md px-3 py-2 text-sm transition-colors",
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
        <SheetFooter className="border-t">
          {userName && <span className="px-1 text-sm text-muted-foreground">{userName}</span>}
          <SignOutButton />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
