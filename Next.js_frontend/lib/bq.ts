import { BigQuery } from '@google-cloud/bigquery'

/**
 * BigQuery access for the partner portal.
 *
 * Every partner-scoped query must filter inventory through `PARTNER_SITES_CTE`
 * (or `partnerTagFilter`). Do not hand-roll the label matching anywhere else —
 * a label is `<TAG>-<domain>` (e.g. `AGX-1001-yasobe.com`) and the session
 * tag must match that prefix including its trailing hyphen. A bare prefix
 * would leak one partner's sites into another's dashboard (`pt-24` vs
 * `pt-24ak` are different partners and differ only by suffix).
 */

const PROJECT_ID = process.env.BIGQUERY_PROJECT_ID ?? 'adblobex'
const DATASET = process.env.BIGQUERY_DATASET ?? 'MA_BOT_DATA'
const LOCATION = process.env.BIGQUERY_LOCATION ?? 'asia-southeast1'

let client: BigQuery | undefined

export function bigquery(): BigQuery {
  if (!client) {
    // The service-account JSON is pasted inline in .env.local as
    // BIGQUERY_CREDENTIALS_JSON (no file path): on the deployed serverless
    // host a credentials file does not exist, so ADC's
    // GOOGLE_APPLICATION_CREDENTIALS path fails there with ENOENT under
    // /var/task. Falls back to ADC when the variable is unset (local gcloud).
    const json = process.env.BIGQUERY_CREDENTIALS_JSON
    client = json
      ? new BigQuery({ projectId: PROJECT_ID, location: LOCATION, credentials: JSON.parse(json) })
      : new BigQuery({ projectId: PROJECT_ID, location: LOCATION })
  }
  return client
}

export const table = (name: string) => `\`${PROJECT_ID}.${DATASET}.${name}\``

/** Application dataset table (identity records), fully qualified. */
export const appTable = (name: string) => `\`${PROJECT_ID}.ma_new_data.${name}\``

export interface PartnerRecord {
  partner_id: string
  partner_ticket: string
  name: string
  status: string
  /**
   * Ceiling on the child's revenue share, as a whole percent. Null means the
   * admin set no cap and the full 0-100 range is available.
   */
  max_revenue_share: number | null
}

/**
 * Resolve the partner identity record for a portal session by tag.
 *
 * The partner tag is the lowercased ticket, so the match is a case-insensitive
 * ticket equality. Returns null when no partner exists for the tag.
 */
export async function getPartnerRecord(partnerTag: string): Promise<PartnerRecord | null> {
  const { rows } = await runQuery<PartnerRecord>(
    `SELECT partner_id, partner_ticket, name, status, max_revenue_share
     FROM ${appTable('partners')}
     WHERE LOWER(partner_ticket) = @partner_tag
     LIMIT 1`,
    { partner_tag: partnerTag },
  )
  return rows[0] ?? null
}

/**
 * Membership test: does a `label` belong to the session's partner tag?
 *
 * The label is `<TAG>-<domain>` — the tag LEADS the label and the hyphen
 * right after it is the delimiter. Matching `tag + '-'` as a case-insensitive
 * prefix keeps it exact rather than a bare prefix: `pt-24-` never matches
 * `pt-24ak-yasobe.com`, because that label has `a` where the delimiter `-`
 * is required. Source data varies in case (`pt-24` and `PT-24` both occur),
 * so the label is lowercased; `@partner_tag` arrives lowercased from
 * `normalizeTag`.
 *
 * Invariant: no partner tag may start with another tag followed by a hyphen
 * (e.g. `pt-24` and `pt-24-x` cannot both exist). The ticket generator
 * (`AGX-<seq>`, core/utils.py) never emits a second hyphen, and the seeded
 * tags (`pt-24` vs `pt-24ak`) differ without one — so the delimiter always
 * resolves the tag boundary unambiguously.
 */
export const TAG_PREFIX_EXPR = (labelCol: string) =>
  `STARTS_WITH(LOWER(${labelCol}), @partner_tag || '-')`

/**
 * Restricts a `network_codes`-shaped relation to one partner.
 * `@partner_tag` must come from the session, never from the request.
 */
export const PARTNER_SITES_CTE = `
  partner_sites AS (
    SELECT
      network_code,
      label,
      account_status,
      invitation_status,
      approval_status,
      delegation_type,
      revenue_share_millipercent,
      email,
      child_publisher_id,
      @partner_tag AS partner_tag
    FROM ${table('network_codes')}
    WHERE ${TAG_PREFIX_EXPR('label')}
  )
`

/** A standalone WHERE predicate, for queries that don't use the CTE. */
export const partnerTagFilter = (labelCol: string) => TAG_PREFIX_EXPR(labelCol)

/**
 * Applicable vs not-applicable inventory.
 *
 * The bot does not store this per date — it folds it into one daily snapshot
 * on `network_code_performance`, which cannot answer an arbitrary window and
 * goes stale whenever `adx_daily_stats` is restated. But the rule behind it is
 * a pure function of a column the daily table already carries: GAM reports web
 * inventory with an empty MOBILE_APP_NAME, which the bot stores as
 * `platform = "(Not applicable)"` (Ma_bot/sync.py:833-847, 1864).
 *
 * So the split is recomputed here from the same rows as the revenue beside it,
 * for any date range, and applicable + not-applicable always equals total.
 */
export const NOT_APPLICABLE_PRED = (platformCol: string) =>
  `TRIM(COALESCE(${platformCol}, '')) = '(Not applicable)'`

/**
 * iOS impressions, using the bot's own keyword list verbatim
 * (Ma_bot/sync.py is_ios_os) so the two never disagree.
 *
 * Note this is an IMPRESSION share. `adx_os_stats` has no revenue column, so
 * an iOS share of revenue cannot be computed at any date.
 */
export const IOS_OS_PRED = (osCol: string) => {
  const s = `LOWER(TRIM(COALESCE(${osCol}, '')))`
  return `(${['iphone', 'ipad', 'ipod', 'ios', 'apple']
    .map((k) => `${s} LIKE '%${k}%'`)
    .join(' OR ')})`
}

/* ------------------------------- coercion ------------------------------- */

/**
 * BigQuery NUMERIC/BIGNUMERIC arrive as strings. Coerce without losing
 * precision silently — an unparseable value becomes 0 rather than NaN, so a
 * single bad row can't poison a partner's total.
 */
export function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'bigint') return Number(value)
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * The driver does not hand back primitives for every type. DATE arrives as a
 * `BigQueryDate` and TIMESTAMP as a `BigQueryTimestamp` — plain objects whose
 * `toString()` is "[object Object]", so a naive `String(r.date)` silently
 * produces garbage that only shows up in the UI. Both carry the real value in
 * a `value` field. NUMERIC types arrive as `Big` (bignumber.js), which has no
 * `value` field but stringifies correctly, so it falls through to String().
 *
 * Use this instead of String() for any DATE/TIMESTAMP column.
 */
export function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') {
    return String(value)
  }
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    const inner = (value as { value?: unknown }).value
    if (typeof inner === 'string') return inner
    if (typeof inner === 'number' || typeof inner === 'bigint') return String(inner)
  }
  return String(value)
}

export interface QueryResult<T> {
  rows: T[]
  /** Total bytes billed — surfaced so cost is visible during development. */
  bytes: number
}

export async function runQuery<T = Record<string, unknown>>(
  query: string,
  params: Record<string, unknown>,
): Promise<QueryResult<T>> {
  // `query(Query)` resolves to [rows, job]. The job carries the stats we want.
  const [rows, job] = await bigquery().query({
    query,
    params,
    location: LOCATION,
    useQueryCache: true,
  })

  return {
    rows: rows as T[],
    bytes: Number(job?.statistics?.totalBytesProcessed ?? 0),
  }
}
