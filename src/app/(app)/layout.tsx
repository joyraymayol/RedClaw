import { Logo } from "@/components/logo";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser } from "@/lib/auth";

// Minimal authenticated shell (full sidebar lands in Phase 1). The user
// fetch here is for display only — layouts don't re-render on navigation,
// so each protected page enforces access itself via the DAL.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <Logo />
          <div className="flex items-center gap-2">
            {user && (
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user.name}
              </span>
            )}
            <SignOutButton />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
