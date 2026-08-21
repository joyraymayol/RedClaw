"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PerPageSelect({
  options,
  defaultValue,
  paramName = "perPage",
  pageParamName = "page",
  label = "Items per page",
}: {
  options: readonly number[];
  defaultValue: number;
  paramName?: string;
  pageParamName?: string;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramName) ?? String(defaultValue);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="whitespace-nowrap">{label}</span>
      <Select
        value={current}
        onValueChange={(value) => {
          if (!value) return;
          const params = new URLSearchParams(searchParams);
          params.delete(pageParamName);
          if (value === String(defaultValue)) params.delete(paramName);
          else params.set(paramName, value);
          const query = params.toString();
          router.replace(query ? `${pathname}?${query}` : pathname);
        }}
      >
        <SelectTrigger size="sm" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
