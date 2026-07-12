import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BookOpen,
  Boxes,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  Timer,
} from "lucide-react";

import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: ClipboardList,
    title: "Work order tickets",
    body: "Raise, assign and track tickets through a strict lifecycle — one active job per technician, nothing falls between shifts.",
  },
  {
    icon: CalendarClock,
    title: "Preventive maintenance",
    body: "Time- and usage-based schedules generate tickets automatically, before the machine decides for you.",
  },
  {
    icon: Activity,
    title: "Downtime & reliability",
    body: "Downtime logged per asset, MTBF and MTTR computed for you — no spreadsheet archaeology.",
  },
  {
    icon: Boxes,
    title: "Spare parts inventory",
    body: "Parts logged on every fix, stock decremented safely, reorder flags raised before the bin runs dry.",
  },
  {
    icon: Timer,
    title: "SLA compliance",
    body: "Acknowledge and resolve targets per priority, breach flags and automatic escalation built in.",
  },
  {
    icon: BookOpen,
    title: "Knowledge base",
    body: "Proven fixes attached to problem types and suggested at ticket creation — experience that stays on the floor.",
  },
];

const lifecycle = ["OPEN", "ASSIGNED", "IN PROGRESS", "VERIFY", "CLOSED"];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* backdrop-blur lives on its own layer, not the sticky element itself —
          iOS WebKit can swallow touch events on interactive children when
          `position: sticky` and `backdrop-filter` share the same element. */}
      <header className="sticky top-0 z-50">
        <div
          aria-hidden
          className="absolute inset-0 border-b border-border/60 bg-background/80 backdrop-blur"
        />
        <div className="relative mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <Logo />
          <div className="flex items-center gap-1.5">
            <nav className="mr-2 hidden items-center gap-5 text-sm text-muted-foreground md:flex">
              <a href="#workflow" className="transition-colors hover:text-foreground">
                Workflow
              </a>
              <a href="#features" className="transition-colors hover:text-foreground">
                Features
              </a>
            </nav>
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Log in
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="bg-blueprint absolute inset-0" />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-48 right-[-10%] size-[34rem] rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-6 py-20 lg:grid-cols-2 lg:py-28">
            <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700">
              <p className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 font-mono text-[11px] tracking-wide text-muted-foreground">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                SYSTEMS ONLINE · BUILT FOR THE PLANT FLOOR
              </p>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Every machine. Every ticket.{" "}
                <span className="text-primary">Under control.</span>
              </h1>
              <p className="mt-5 max-w-prose text-lg text-muted-foreground">
                RedClaw is the maintenance command center for your factory —
                raise work orders, dispatch technicians, schedule preventive
                maintenance, and keep downtime where it belongs: on a report.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className={cn(buttonVariants({ size: "lg" }), "px-5")}
                >
                  Sign in to console
                  <ArrowRight data-icon="inline-end" />
                </Link>
                <a
                  href="#features"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "px-5"
                  )}
                >
                  Explore features
                </a>
              </div>
              <p className="mt-10 font-mono text-[11px] tracking-wide text-muted-foreground">
                MTBF · MTTR TRACKED&ensp;/&ensp;SLA TIMERS&ensp;/&ensp;AUDIT-READY HISTORY
              </p>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both relative delay-150 duration-700">
              <div
                aria-hidden
                className="absolute -inset-8 -z-10 rounded-full bg-primary/10 blur-2xl"
              />
              <div className="relative rounded-2xl border bg-card p-2 shadow-lg">
                <span aria-hidden className="absolute -top-1.5 -left-1.5 size-4 border-t-2 border-l-2 border-primary/70" />
                <span aria-hidden className="absolute -top-1.5 -right-1.5 size-4 border-t-2 border-r-2 border-primary/70" />
                <span aria-hidden className="absolute -bottom-1.5 -left-1.5 size-4 border-b-2 border-l-2 border-primary/70" />
                <span aria-hidden className="absolute -right-1.5 -bottom-1.5 size-4 border-r-2 border-b-2 border-primary/70" />
                <div className="flex items-center gap-1.5 px-3 py-2">
                  <span className="size-2 rounded-full bg-muted-foreground/30" />
                  <span className="size-2 rounded-full bg-muted-foreground/30" />
                  <span className="size-2 rounded-full bg-primary/70" />
                  <span className="ml-auto font-mono text-[10px] tracking-wider text-muted-foreground">
                    REDCLAW://WORKSHOP-01
                  </span>
                </div>
                <Image
                  src="/hero-workshop-redclaw.png"
                  alt="Pixel-art RedClaw lobster tuning a lathe in a workshop"
                  width={1024}
                  height={1024}
                  priority
                  className="h-auto w-full rounded-lg"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="border-t">
          <div className="mx-auto w-full max-w-6xl px-6 py-16">
            <p className="font-mono text-[11px] tracking-widest text-primary">
              WORKFLOW
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Built around the way tickets actually move
            </h2>
            <div className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-3">
              {lifecycle.map((step, i) => (
                <span key={step} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-md border bg-card px-3 py-1.5 font-mono text-xs transition-colors",
                      step === "IN PROGRESS"
                        ? "border-primary/50 text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    {step}
                  </span>
                  {i < lifecycle.length - 1 && (
                    <ChevronRight className="size-3.5 text-muted-foreground/50" />
                  )}
                </span>
              ))}
            </div>
            <p className="mt-6 max-w-prose text-sm text-muted-foreground">
              Holds for parts and vendors, requester verification, reopens and
              supervisor sign-off included — and every single transition is
              audit-logged with who, when and why.
            </p>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t">
          <div className="mx-auto w-full max-w-6xl px-6 py-16">
            <p className="font-mono text-[11px] tracking-widest text-primary">
              CAPABILITIES
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              One console for the whole maintenance loop
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="group rounded-xl border bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40"
                >
                  <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 font-medium">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t">
          <div className="mx-auto w-full max-w-6xl px-6 py-20 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Put your plant floor on{" "}
              <span className="text-primary">RedClaw</span>.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              Sign in with your maintenance account and pick up where the last
              shift left off.
            </p>
            <Link
              href="/login"
              className={cn(buttonVariants({ size: "lg" }), "mt-8 px-6")}
            >
              Sign in
              <ArrowRight data-icon="inline-end" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-8 font-mono text-[11px] tracking-wide text-muted-foreground">
          <span>© 2026 REDCLAW · PLASPACK MAINTENANCE</span>
          <span>V0.1.0 · PHASE 0</span>
        </div>
      </footer>
    </div>
  );
}
