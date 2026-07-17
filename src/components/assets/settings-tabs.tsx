"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs } from "@/components/ui/tabs";

/** Syncs the active tab to `?tab=` so a section's search/pagination links
    (which re-navigate the whole page) land back on the tab the user was on,
    and a bookmarked/refreshed URL reopens the same section. */
export function SettingsTabs({
  defaultTab,
  children,
}: {
  defaultTab: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? defaultTab;

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        const next = typeof value === "string" ? value : defaultTab;
        const params = new URLSearchParams(searchParams);
        if (next === defaultTab) params.delete("tab");
        else params.set("tab", next);
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
      }}
    >
      {children}
    </Tabs>
  );
}
