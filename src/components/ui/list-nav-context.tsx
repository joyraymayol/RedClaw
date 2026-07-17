"use client";

import { createContext, useContext, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type ListNav = { navigate: (href: string) => void; isPending: boolean };

const ListNavContext = createContext<ListNav | null>(null);

/** Returns null outside a ListNavProvider so consumers (e.g. PerPageSelect)
    can fall back to a plain router call on pages that don't opt in. */
export function useListNav() {
  return useContext(ListNavContext);
}

/**
 * Wraps a results region so every plain `<Link>`/`<a>` click inside it
 * (filter tabs, sort headers, pagination) shares one `useTransition`, and
 * intercepts them so navigation feels instant instead of leaving the user
 * unsure whether their click registered. Pair with `ListNavPending` to swap
 * in a skeleton for the part of the tree that's stale while `isPending`.
 */
export function ListNavProvider({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigate(href: string) {
    startTransition(() => {
      router.push(href);
    });
  }

  function handleClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor) return;
    if (anchor.target && anchor.target !== "_self") return;
    if (anchor.hasAttribute("download")) return;
    const url = new URL(anchor.href, window.location.origin);
    if (url.origin !== window.location.origin) return;
    e.preventDefault();
    navigate(url.pathname + url.search);
  }

  return (
    <ListNavContext.Provider value={{ navigate, isPending }}>
      <div className={className} onClickCapture={handleClickCapture}>
        {children}
      </div>
    </ListNavContext.Provider>
  );
}

/** Swaps to `fallback` while a navigation started anywhere in the enclosing
    ListNavProvider is pending; renders `children` (the stale-but-real
    server-rendered content) otherwise. */
export function ListNavPending({
  fallback,
  children,
}: {
  fallback: ReactNode;
  children: ReactNode;
}) {
  const nav = useListNav();
  return (
    <div aria-busy={nav?.isPending ?? false}>{nav?.isPending ? fallback : children}</div>
  );
}
