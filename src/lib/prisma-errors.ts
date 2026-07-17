/**
 * True if `error` is a Prisma unique-constraint violation (P2002) on `field`.
 *
 * The affected-column list shows up in two different shapes depending on
 * how the error reached the client: `meta.target` (classic query engine)
 * or `meta.driverAdapterError.cause.constraint.fields` (the `@prisma/adapter-pg`
 * driver adapter this project uses) — check both.
 */
export function isUniqueConstraintError(error: unknown, field: string): boolean {
  if (!(error instanceof Error) || !("code" in error) || error.code !== "P2002") {
    return false;
  }
  const meta = "meta" in error ? error.meta : undefined;
  if (!meta || typeof meta !== "object") return false;

  if ("target" in meta && Array.isArray(meta.target) && meta.target.includes(field)) {
    return true;
  }

  const driverAdapterError = (meta as { driverAdapterError?: unknown }).driverAdapterError;
  const fields = (
    driverAdapterError as { cause?: { constraint?: { fields?: unknown } } } | undefined
  )?.cause?.constraint?.fields;
  return Array.isArray(fields) && fields.includes(field);
}

/** True if `error` is a Prisma foreign-key-constraint violation (P2003/P2014) — e.g. deleting a row other rows still reference. */
export function isForeignKeyConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error.code === "P2003" || error.code === "P2014")
  );
}
