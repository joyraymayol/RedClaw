"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Columns3Icon, Loader2Icon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_PER_PAGE,
  PER_PAGE_OPTIONS,
  parseHiddenColumns,
  SHOW_ALL_COLUMNS,
  USER_TABLE_COLUMNS,
  type UserColumnKey,
} from "@/lib/constants/users-table";
import { cn } from "@/lib/utils";

/** Replace the URL with updated params, dropping `page` so a new
    search/page-size always starts from the first page. */
function useParamNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams);
    params.delete("page");
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };
}

export function UsersSearch({ className }: { className?: string } = {}) {
  const searchParams = useSearchParams();
  const navigate = useParamNavigation();
  const urlQuery = searchParams.get("q") ?? "";

  const [value, setValue] = useState(urlQuery);
  const [isWaiting, setIsWaiting] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Kept in a ref so the debounce timeout always navigates with the
  // params current at fire time, not at keystroke time.
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  });

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  function handleChange(next: string) {
    setValue(next);
    setIsWaiting(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsWaiting(false);
      navigateRef.current({ q: next.trim() });
    }, 500);
  }

  return (
    <div className={cn("relative w-full sm:w-80", className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search name, email, department…"
        aria-label="Search users"
        className="pl-8"
      />
      {isWaiting && (
        <Loader2Icon className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}

export function PerPageSelect() {
  const searchParams = useSearchParams();
  const navigate = useParamNavigation();
  const current = searchParams.get("perPage") ?? String(DEFAULT_PER_PAGE);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="whitespace-nowrap">Rows per page</span>
      <Select
        value={current}
        onValueChange={(value) =>
          navigate({
            perPage: value === String(DEFAULT_PER_PAGE) ? null : String(value),
          })
        }
      >
        <SelectTrigger size="sm" aria-label="Rows per page">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PER_PAGE_OPTIONS.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ColumnsToggle() {
  const searchParams = useSearchParams();
  const navigate = useParamNavigation();
  const hidden = parseHiddenColumns(searchParams.get("hide"));

  function toggle(key: UserColumnKey, visible: boolean) {
    const next = new Set(hidden);
    if (visible) next.delete(key);
    else next.add(key);
    navigate({ hide: next.size === 0 ? SHOW_ALL_COLUMNS : [...next].join(",") });
  }

  return (
    // The toggle only affects columns once the viewport is wide enough to
    // show them (see the `hidden lg:table-cell` classes in the users
    // table); below that, it wouldn't visibly do anything.
    <div className="hidden lg:block">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm">
              <Columns3Icon className="size-4" />
              Columns
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {USER_TABLE_COLUMNS.map((col) => (
            <DropdownMenuCheckboxItem
              key={col.key}
              checked={!hidden.has(col.key)}
              onCheckedChange={(visible) => toggle(col.key, visible)}
            >
              {col.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
