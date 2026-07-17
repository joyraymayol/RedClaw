"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2Icon, SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function DebouncedSearchInput({
  paramName = "q",
  placeholder,
  ariaLabel,
  resetParams = [],
  className,
}: {
  paramName?: string;
  placeholder: string;
  ariaLabel: string;
  /** Other search params to drop whenever this input's value changes — a
      page param scoped to the same list, for instance. */
  resetParams?: string[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get(paramName) ?? "";

  const [value, setValue] = useState(urlQuery);
  const [isWaiting, setIsWaiting] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  function handleChange(next: string) {
    setValue(next);
    setIsWaiting(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsWaiting(false);
      const params = new URLSearchParams(searchParams);
      const trimmed = next.trim();
      if (trimmed) params.set(paramName, trimmed);
      else params.delete(paramName);
      for (const key of resetParams) params.delete(key);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    }, 500);
  }

  return (
    <div className={cn("relative w-full sm:max-w-xs", className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="pl-8"
      />
      {isWaiting && (
        <Loader2Icon className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}
