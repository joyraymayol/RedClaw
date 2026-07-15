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
