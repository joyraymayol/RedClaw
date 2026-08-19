"use client";

import { Fragment } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useListNav } from "@/components/ui/list-nav-context";

export type SortDir = "asc" | "desc";

export type SortField = {
  value: string;
  label: string;
};

const CLEAR_VALUE = "__clear__";

/**
 * Button + dropdown for choosing a sort field/direction via URL params —
 * the same `sort`/`dir` params driving each page's clickable column headers,
 * so this is just an alternate (and mobile-reachable) way to set them. Each
 * field lists both directions explicitly, plus a "Clear sort" entry that
 * resets back to the natural/default order.
 */
export function SortButton({
  fields,
  defaultSort,
  defaultDir,
  sortParam = "sort",
  dirParam = "dir",
  resetParams = ["page"],
}: {
  fields: SortField[];
  defaultSort: string;
  defaultDir: SortDir;
  sortParam?: string;
  dirParam?: string;
  resetParams?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Falls back to a plain router.replace on pages that don't wrap their
  // table in a ListNavProvider; where one is present (e.g. tickets), routing
  // through it gives the same instant pending-skeleton feedback the
  // Link-based column headers and filter tabs already get — otherwise this
  // button's clicks are invisible to that provider's <a>-only interception
  // and the table just sits frozen for the length of the RSC round-trip.
  const nav = useListNav();
  // Every page's own href-builder (and its server-side searchParams parsing)
  // treats an absent `dir` as "asc" whenever `sort` is explicitly present —
  // it only falls back to that page's DEFAULT_DIR when `sort` is *also*
  // absent (the true reset state). Comparing `dir` against `defaultDir`
  // unconditionally — independent of whether `sort` is at its default — is
  // wrong on any page where defaultDir is "desc" (tickets): picking a
  // non-default field's Descending option would compare dir "desc" against
  // defaultDir "desc", omit the param, and silently produce ascending order
  // instead — the exact mismatch that made this button disagree with the
  // column headers.
  const rawSort = searchParams.get(sortParam);
  const currentSort = rawSort ?? defaultSort;
  const currentDir: SortDir = rawSort
    ? searchParams.get(dirParam) === "desc"
      ? "desc"
      : "asc"
    : defaultDir;

  function navigate(value: string, dir: SortDir) {
    const params = new URLSearchParams(searchParams);
    for (const key of resetParams) params.delete(key);
    if (value === defaultSort && dir === defaultDir) {
      params.delete(sortParam);
      params.delete(dirParam);
    } else {
      params.set(sortParam, value);
      if (dir === "desc") params.set(dirParam, "desc");
      else params.delete(dirParam);
    }
    const query = params.toString();
    const target = query ? `${pathname}?${query}` : pathname;
    if (nav) nav.navigate(target);
    else router.replace(target);
  }

  const isCleared = currentSort === defaultSort && currentDir === defaultDir;
  const selected = isCleared ? CLEAR_VALUE : `${currentSort}:${currentDir}`;

  function handleValueChange(value: string) {
    if (value === CLEAR_VALUE) {
      navigate(defaultSort, defaultDir);
      return;
    }
    const [fieldValue, dir] = value.split(":");
    navigate(fieldValue, dir === "desc" ? "desc" : "asc");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm">
            <ArrowUpDownIcon className="size-4" />
            Sort
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuRadioGroup value={selected} onValueChange={handleValueChange}>
          <DropdownMenuRadioItem value={CLEAR_VALUE} closeOnClick>
            <XIcon className="size-4" />
            Clear sort
          </DropdownMenuRadioItem>
          {fields.map((field) => (
            <Fragment key={field.value}>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>{field.label}</DropdownMenuLabel>
              <DropdownMenuRadioItem value={`${field.value}:asc`} closeOnClick>
                <ArrowUpIcon className="size-4" />
                Ascending
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value={`${field.value}:desc`} closeOnClick>
                <ArrowDownIcon className="size-4" />
                Descending
              </DropdownMenuRadioItem>
            </Fragment>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
