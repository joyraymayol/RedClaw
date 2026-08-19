// Plain module (no "use client") so both the server page and the client
// table controls import real values, not client-reference proxies.
export const PER_PAGE_OPTIONS = [20, 30, 40, 50] as const;
export const DEFAULT_PER_PAGE = 20;

// Name, Status, and Actions are pinned — always shown. These are the
// columns a user can hide via the Columns toggle; same set that already
// collapses first on narrow screens (see `hidden md:table-cell` etc. in
// the users table), so hiding them by choice or by viewport width means
// the same thing to the layout.
export const USER_TABLE_COLUMNS = [
  { key: "email", label: "Email" },
  { key: "department", label: "Department" },
  { key: "position", label: "Position" },
  { key: "joined", label: "Joined" },
] as const;
export type UserColumnKey = (typeof USER_TABLE_COLUMNS)[number]["key"];
export const DEFAULT_HIDDEN_COLUMNS: UserColumnKey[] = ["joined"];

const COLUMN_KEYS = new Set(USER_TABLE_COLUMNS.map((c) => c.key));

/** Sentinel for an explicit "show all" — distinct from the param being
    absent, which falls back to `DEFAULT_HIDDEN_COLUMNS` instead. Plain
    empty string can't be used for this: URLSearchParams updates treat
    "" as "delete the param", which would collapse back to the default. */
export const SHOW_ALL_COLUMNS = "none";

/** `hide` query param -> hidden-column set. `null` (param absent) falls
    back to the default. */
export function parseHiddenColumns(hideParam: string | null): Set<UserColumnKey> {
  if (hideParam === null) return new Set(DEFAULT_HIDDEN_COLUMNS);
  if (hideParam === SHOW_ALL_COLUMNS) return new Set();
  return new Set(
    hideParam
      .split(",")
      .filter((k): k is UserColumnKey => COLUMN_KEYS.has(k as UserColumnKey))
  );
}
