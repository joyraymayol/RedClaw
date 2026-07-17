import { z } from "zod";

/**
 * An optional FormData field that normalizes to `undefined`.
 *
 * `FormData.get()` returns `null` for a field that's absent from the
 * form entirely (e.g. a conditionally-rendered <Select>) and `""` for
 * one that's present but empty — zod's `.optional()` only accepts
 * `undefined`, so either raw value fails validation without this.
 */
export const optionalId = () =>
  z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    z.string().min(1).optional()
  );

export const optionalText = (max: number) =>
  z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    z.string().trim().max(max).optional()
  );

/**
 * A checkbox field submitted via a controlled hidden input (value always
 * "true" or "false", never absent) — see asset-category-form-dialog.tsx.
 */
export const checkboxBoolean = () =>
  z.preprocess((v) => v === "true", z.boolean());

/** An optional date field from an `<input type="date">` — "" means unset. */
export const optionalDate = () =>
  z.preprocess(
    (v) => (v === null || v === "" ? undefined : v),
    z.coerce.date().optional()
  );
