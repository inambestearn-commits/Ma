/**
 * Date-range helpers shared by the partner API routes and the client pages.
 *
 * The reporting warehouse is UTC, so every boundary is the UTC calendar date.
 * Keeping the logic here means the picker the user sees and the filter the API
 * applies can never drift apart.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false
  // Rejects 2026-02-30 and friends, which regex alone would accept.
  return !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Shifts an ISO date by whole days. Used by the range presets. */
export function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export interface DateRange {
  from: string
  to: string
}

/**
 * Clamps a requested range to something the warehouse can actually answer:
 * both ends must be real dates, `from` cannot sit after `to` (they swap), and
 * neither end may point into the future. Missing/invalid input falls back to
 * today, so the default view is always a single, valid day.
 */
export function normalizeRange(from: unknown, to: unknown): DateRange {
  const today = todayIso()
  let f = isIsoDate(from) ? from : today
  let t = isIsoDate(to) ? to : today
  if (f > t) [f, t] = [t, f]
  if (t > today) t = today
  if (f > today) f = today
  return { from: f, to: t }
}

/** Human label for a range: "2026-10-02 → 2026-10-10", or just the day. */
export function rangeLabel({ from, to }: DateRange): string {
  return from === to ? from : `${from} → ${to}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * "2026-10-09T21:03:33.328319Z" -> "9 Oct 2026, 21:03" in UTC.
 *
 * Deliberately not `toLocaleString`: the warehouse is UTC and the rest of the
 * portal labels its figures UTC, so a browser-local rendering here would make
 * a ticket look like it was filed on a different day than the revenue next to
 * it. Returns "—" for anything unparseable rather than "Invalid Date".
 */
export function formatUtcShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(
    d.getUTCMinutes(),
  )}`
}

/** Shorter form for dense tables: "9 Oct, 21:03". */
export function formatUtcCompact(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}
