/** Stale state or a concurrency loss (optimistic guard, stock check, unique index). Renders as a friendly "refresh and retry" message, not a 500. */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
