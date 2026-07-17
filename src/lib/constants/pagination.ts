// Plain module (no "use client") so both server pages and client table
// controls import real values, not client-reference proxies.
export const PER_PAGE_OPTIONS = [10, 20, 30, 50] as const;
export const DEFAULT_PER_PAGE = 10;
