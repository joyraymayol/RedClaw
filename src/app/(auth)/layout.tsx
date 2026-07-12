import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div aria-hidden className="bg-blueprint absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 size-[30rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <header className="relative z-10">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <Logo />
          <ThemeToggle />
        </div>
      </header>
      <main className="relative z-10 grid flex-1 place-items-center px-6 pb-20">
        {children}
      </main>
    </div>
  );
}
