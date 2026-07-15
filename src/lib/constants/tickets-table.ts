// Plain module (no "use client") so both the server page and the client
// table controls import real values, not client-reference proxies.
export const PER_PAGE_OPTIONS = [20, 30, 40, 50] as const;
export const DEFAULT_PER_PAGE = 20;
