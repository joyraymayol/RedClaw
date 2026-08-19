import { cookies } from "next/headers";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Logo } from "@/components/logo";
import { NotificationBell } from "@/components/layout/notification-bell";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getCurrentUser } from "@/lib/auth";

// The user fetch here is for display/nav only — layouts don't re-render on
// navigation, so each protected page still enforces access itself via the DAL.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  // Non-active users (e.g. mid-redirect to /pending-approval) get a bare shell
  // with no navigation — matching the previous behaviour.
  if (!user || user.status !== "ACTIVE") {
    return (
      <div className="flex min-h-dvh flex-col">
        <header className="flex h-14 items-center justify-between border-b px-6">
          <Logo />
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
          {children}
        </main>
      </div>
    );
  }

  // Restore the persisted collapsed/expanded state before first paint.
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <TooltipProvider delay={0}>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar role={user.role} userName={user.name} avatarUrl={user.avatarUrl} />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <div
              role="separator"
              aria-orientation="vertical"
              className="h-4 w-px shrink-0 self-center bg-border"
            />
            <Logo />
            <div
              role="separator"
              aria-orientation="vertical"
              className="hidden h-4 w-px shrink-0 self-center bg-border md:block"
            />
            <div className="hidden min-w-0 md:block">
              <Breadcrumbs />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-sm text-muted-foreground lg:inline">
                {user.name}
              </span>
              <NotificationBell userId={user.id} />
              <SignOutButton />
              <ThemeToggle />
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
