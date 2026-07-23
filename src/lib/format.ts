/**
 * Centralized date/time formatting (locale "en-PH"). Before this, every
 * render site called `toLocale*` inline — inconsistent, and a hazard in
 * Client Components: Node's ICU and the browser disagree on *combined*
 * date+time output ("Jul 15, 5:13 PM" vs "Jul 15 at 5:13 PM"), which
 * breaks hydration (commit f48d43a). Rules:
 *   - `formatDate`      — date only.
 *   - `formatDateTime`  — combined date+time; SERVER COMPONENTS ONLY.
 *   - `formatDateTimeParts` — split date + time for CLIENT COMPONENTS,
 *      which the caller joins with a fixed separator so both renderers agree.
 */

const LOCALE = "en-PH";

const DATE_OPTS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

const TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
};

type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Date only, e.g. "Jul 20, 2026". */
export function formatDate(value: DateInput): string {
  return toDate(value).toLocaleDateString(LOCALE, DATE_OPTS);
}

/** Combined date + time, e.g. "Jul 20, 2026, 5:13 PM". Server Components only. */
export function formatDateTime(value: DateInput): string {
  return toDate(value).toLocaleString(LOCALE, { ...DATE_OPTS, ...TIME_OPTS });
}

/**
 * Date and time formatted separately, for Client Components — join with a
 * fixed separator (e.g. `${date}, ${time}`) so server and browser agree.
 */
export function formatDateTimeParts(value: DateInput): { date: string; time: string } {
  const d = toDate(value);
  return {
    date: d.toLocaleDateString(LOCALE, DATE_OPTS),
    time: d.toLocaleTimeString(LOCALE, TIME_OPTS),
  };
}
