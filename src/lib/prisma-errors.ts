/** True if `error` is a Prisma unique-constraint violation (P2002) on `field`. */
export function isUniqueConstraintError(error: unknown, field: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "P2002" &&
    "meta" in error &&
    !!error.meta &&
    typeof error.meta === "object" &&
    "target" in error.meta &&
    Array.isArray(error.meta.target) &&
    error.meta.target.includes(field)
  );
}

/** True if `error` is a Prisma foreign-key-constraint violation (P2003/P2014) — e.g. deleting a row other rows still reference. */
export function isForeignKeyConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "P2003" || error.code === "P2014")
  );
}
