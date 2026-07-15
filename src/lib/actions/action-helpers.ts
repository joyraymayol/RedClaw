import { ForbiddenError } from "@/lib/authz";
import { ConflictError } from "@/lib/errors";

/**
 * Wraps a Server Action body so ForbiddenError (assertCan) and
 * ConflictError (stale-state guards) become a friendly `{ error }` result
 * instead of an unhandled 500 (plan §8). Anything else — a genuine bug,
 * or Next's redirect()/notFound() control-flow throws — propagates as-is.
 */
export async function runAction<T extends { error?: string }>(
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof ConflictError) {
      return { error: e.message } as T;
    }
    throw e;
  }
}
