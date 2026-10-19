import { NextRequest, NextResponse } from 'next/server'
import {
  IOS_OS_PRED,
  NOT_APPLICABLE_PRED,
  PARTNER_SITES_CTE,
  runQuery,
  table,
  toNumber,
  toText,
} from '@/lib/bq'
import { bigQueryError, requirePartner } from '@/lib/api-partner'
import { displayDomain } from '@/lib/label'
import { normalizeRange } from '@/lib/date'

export const dynamic = 'force-dynamic'

const MAX_PAGE_SIZE = 100

/**
 * The dimensions this warehouse can answer.
 *
 * `adx_daily_stats` carries `platform` (traffic source), `adx_os_stats` carries
 * `os`, and `adx_geo_stats` carries `country`/`carrier`/`browser`. Every one of
 * them joins back to `partner_sites`, so the session tag scopes them all.
 */
const DIMENSIONS = [
  'overview',
  'site',
  'traffic_source',
  'device',
  'country',
  'carrier',
  'browser',
  'country_carrier',
] as const
type Dimension = (typeof DIMENSIONS)[number]

function parseDimension(raw: string | null): Dimension {
  return (DIMENSIONS as readonly string[]).includes(raw ?? '') ? (raw as Dimension) : 'overview'
}

export async function GET(request: NextRequest) {
  const auth = await requirePartner()
  if (auth instanceof NextResponse) return auth

  const params = request.nextUrl.searchParams
  const dimension = parseDimension(params.get('dimension'))
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(params.get('page_size') ?? 8) || 8))
  const offset = (page - 1) * pageSize

  // Every fact table in this warehouse is partitioned by `date`, so all eight
  // dimensions can answer a range honestly. normalizeRange clamps and swaps, so
  // a junk or future value degrades to "today" rather than erroring.
  const { from, to } = normalizeRange(params.get('from'), params.get('to'))
  const isToday = from === to && from === normalizeRange(null, null).from

  try {
    // Range aggregates computed straight from the daily table. Aggregating per
    // network_code first is deliberate: joining adx_daily_stats straight onto
    // partner_sites multiplies one site by its days AND its platforms, so a
    // COUNT(*) over that join inflates the site count.
    //
    // iOS impression share IS range-answerable: adx_os_stats carries both `os`
    // and `date`, and the bot's own keyword list identifies the iOS rows.
    //
    // Applicable revenue is range-answerable too, and for the same reason it
    // used to look impossible: the split is a pure function of `platform`, a
    // column adx_daily_stats already carries. The bot folds it into a
    // once-a-day snapshot with no per-row date, but recomputing it here from
    // the same rows as the revenue means it answers any window and always
    // adds up to the revenue shown beside it.
    const totalsSql = `
      WITH ${PARTNER_SITES_CTE},
      site_daily AS (
        SELECT
          network_code,
          SUM(revenue) AS revenue,
          SUM(impressions) AS impressions,
          SUM(clicks) AS clicks,
          SUM(IF(${NOT_APPLICABLE_PRED('platform')}, revenue, 0)) AS not_applicable_revenue,
          SUM(IF(NOT ${NOT_APPLICABLE_PRED('platform')}, revenue, 0)) AS applicable_revenue
        FROM ${table('adx_daily_stats')}
        WHERE date BETWEEN @from AND @to
          AND network_code IN (SELECT network_code FROM partner_sites)
        GROUP BY network_code
      ),
      site_os AS (
        SELECT
          SUM(IF(${IOS_OS_PRED('o.os')}, o.impressions, 0)) AS ios_impressions,
          SUM(o.impressions) AS os_impressions
        FROM ${table('adx_os_stats')} o
        WHERE o.date BETWEEN @from AND @to
          AND o.network_code IN (SELECT network_code FROM partner_sites)
      )
      SELECT
        (SELECT COUNT(*) FROM partner_sites) AS total_sites,
        (SELECT COUNT(*) FROM site_daily) AS sites_with_data,
        (SELECT COUNTIF(impressions > 0) FROM site_daily) AS sites_earning,
        (SELECT COALESCE(SUM(revenue), 0) FROM site_daily) AS revenue,
        (SELECT COALESCE(SUM(impressions), 0) FROM site_daily) AS impressions,
        (SELECT COALESCE(SUM(clicks), 0) FROM site_daily) AS clicks,
        (SELECT COALESCE(SUM(applicable_revenue), 0) FROM site_daily) AS applicable_revenue,
        (SELECT COALESCE(SUM(not_applicable_revenue), 0) FROM site_daily) AS not_applicable_revenue,
        (SELECT os_impressions FROM site_os) AS os_impressions,
        (SELECT ios_impressions FROM site_os) AS ios_impressions,
        -- Days in the window that actually hold rows, so the UI can tell
        -- "no data here" apart from "the split is genuinely zero".
        (SELECT COUNT(DISTINCT d.date) FROM ${table('adx_daily_stats')} d
           WHERE d.date BETWEEN @from AND @to
             AND d.network_code IN (SELECT network_code FROM partner_sites)) AS data_days,
        (SELECT MAX(p.last_synced_at) FROM ${table('network_code_performance')} p
           WHERE p.network_code IN (SELECT network_code FROM partner_sites)) AS last_synced_at,
        (SELECT MIN(d.date) FROM ${table('adx_daily_stats')} d
           WHERE d.network_code IN (SELECT network_code FROM partner_sites)) AS first_data_date,
        (SELECT MAX(d.date) FROM ${table('adx_daily_stats')} d
           WHERE d.network_code IN (SELECT network_code FROM partner_sites)) AS last_data_date
    `

    // Distinct dates present in the daily table inside the range, for the
    // trend empty-state and the date label.
    const datesSql = `
      WITH ${PARTNER_SITES_CTE}
      SELECT d.date
      FROM ${table('adx_daily_stats')} d
      JOIN partner_sites s USING(network_code)
      WHERE d.date BETWEEN @from AND @to
      GROUP BY 1 ORDER BY 1
    `

    // A single aggregate row, for the "Overview" dimension.
    const overviewSql = `
      WITH ${PARTNER_SITES_CTE}
      SELECT
        COUNT(*) OVER() AS total_rows,
        COALESCE(SUM(d.revenue), 0) AS revenue,
        COALESCE(SUM(d.impressions), 0) AS impressions,
        COALESCE(SUM(d.clicks), 0) AS clicks,
        SAFE_DIVIDE(SUM(d.revenue), NULLIF(SUM(d.impressions), 0)) * 1000 AS ecpm,
        SAFE_DIVIDE(SUM(d.clicks), NULLIF(SUM(d.impressions), 0)) * 100 AS ctr
      FROM partner_sites s
      LEFT JOIN ${table('adx_daily_stats')} d
        ON d.network_code = s.network_code AND d.date BETWEEN @from AND @to
    `

    const siteSql = `
      WITH ${PARTNER_SITES_CTE}
      SELECT
        COUNT(*) OVER() AS total_rows,
        s.label,
        s.network_code,
        s.account_status,
        COALESCE(SUM(d.revenue), 0) AS revenue,
        COALESCE(SUM(d.impressions), 0) AS impressions,
        COALESCE(SUM(d.clicks), 0) AS clicks,
        SAFE_DIVIDE(SUM(d.revenue), NULLIF(SUM(d.impressions), 0)) * 1000 AS ecpm,
        SAFE_DIVIDE(SUM(d.clicks), NULLIF(SUM(d.impressions), 0)) * 100 AS ctr,
        COUNT(DISTINCT d.platform) AS traffic_source_count
      FROM partner_sites s
      -- The date predicate lives in the JOIN, not a WHERE: a WHERE on d.date
      -- would drop the NULL side of the LEFT JOIN and hide every site that
      -- reported nothing in the window, which is exactly the inventory a
      -- partner needs to see as $0.
      LEFT JOIN ${table('adx_daily_stats')} d
        ON d.network_code = s.network_code AND d.date BETWEEN @from AND @to
      GROUP BY s.label, s.network_code, s.account_status
      -- network_code breaks ties so LIMIT/OFFSET pagination is deterministic.
      -- Without it, sites sharing the same revenue AND impressions (common at
      -- $0) can swap order between page queries, duplicating or dropping a row.
      ORDER BY revenue DESC, impressions DESC, s.network_code
      LIMIT @limit OFFSET @offset
    `

    const trafficSourceSql = `
      WITH ${PARTNER_SITES_CTE}
      SELECT
        COUNT(*) OVER() AS total_rows,
        d.platform,
        SUM(d.revenue) AS revenue,
        SUM(d.impressions) AS impressions,
        SUM(d.clicks) AS clicks,
        SAFE_DIVIDE(SUM(d.revenue), NULLIF(SUM(d.impressions), 0)) * 1000 AS ecpm,
        SAFE_DIVIDE(SUM(d.clicks), NULLIF(SUM(d.impressions), 0)) * 100 AS ctr
      FROM ${table('adx_daily_stats')} d
      JOIN partner_sites s USING(network_code)
      WHERE d.date BETWEEN @from AND @to
      GROUP BY d.platform
      HAVING impressions > 0
      ORDER BY revenue DESC, d.platform
      LIMIT @limit OFFSET @offset
    `

    const deviceSql = `
      WITH ${PARTNER_SITES_CTE}
      SELECT
        COUNT(*) OVER() AS total_rows,
        o.os,
        SUM(o.impressions) AS impressions
      FROM ${table('adx_os_stats')} o
      JOIN partner_sites s USING(network_code)
      WHERE o.date BETWEEN @from AND @to
      GROUP BY o.os
      HAVING impressions > 0
      ORDER BY impressions DESC, o.os
      LIMIT @limit OFFSET @offset
    `

    // Geo dimensions all come from adx_geo_stats. The table records "(unknown)"
    // for country and "(none)" for carrier on Wi-Fi traffic — those are real
    // values in the source, not placeholders we invent, so they pass through
    // unchanged.
    const geoSql = (groupBy: string, orderBy: string) => `
      WITH ${PARTNER_SITES_CTE}
      SELECT
        COUNT(*) OVER() AS total_rows,
        ${groupBy},
        SUM(g.revenue) AS revenue,
        SUM(g.impressions) AS impressions,
        SUM(g.clicks) AS clicks,
        SAFE_DIVIDE(SUM(g.revenue), NULLIF(SUM(g.impressions), 0)) * 1000 AS ecpm,
        SAFE_DIVIDE(SUM(g.clicks), NULLIF(SUM(g.impressions), 0)) * 100 AS ctr
      FROM ${table('adx_geo_stats')} g
      JOIN partner_sites s USING(network_code)
      WHERE g.date BETWEEN @from AND @to
      GROUP BY ${groupBy}
      HAVING impressions > 0
      -- The group key breaks ties so LIMIT/OFFSET pagination is deterministic;
      -- equal-revenue rows would otherwise reorder between page queries.
      ORDER BY ${orderBy}, ${groupBy}
      LIMIT @limit OFFSET @offset
    `

    const countrySql = geoSql('g.country', 'revenue DESC')
    const carrierSql = geoSql('g.carrier', 'revenue DESC')
    const browserSql = geoSql('g.browser', 'revenue DESC')
    const countryCarrierSql = geoSql('g.country, g.carrier', 'revenue DESC')

    const rangeArgs = { partner_tag: auth.partnerTag, from, to }
    const [totals, dates] = await Promise.all([
      runQuery(totalsSql, rangeArgs),
      runQuery(datesSql, rangeArgs),
    ])

    // Only the selected dimension is queried — the other three would be wasted
    // bytes on every page view.
    const dimensionArgs = { ...rangeArgs, limit: pageSize, offset }
    const main =
      dimension === 'overview'
        ? await runQuery(overviewSql, rangeArgs)
        : dimension === 'site'
          ? await runQuery(siteSql, dimensionArgs)
          : dimension === 'traffic_source'
            ? await runQuery(trafficSourceSql, dimensionArgs)
            : dimension === 'device'
              ? await runQuery(deviceSql, dimensionArgs)
              : dimension === 'country'
                ? await runQuery(countrySql, dimensionArgs)
                : dimension === 'carrier'
                  ? await runQuery(carrierSql, dimensionArgs)
                  : dimension === 'browser'
                    ? await runQuery(browserSql, dimensionArgs)
                    : await runQuery(countryCarrierSql, dimensionArgs)

    const t = totals.rows[0] ?? {}
    const totalImpressions = toNumber(t.impressions)
    const totalClicks = toNumber(t.clicks)
    const revenueTotal = toNumber(t.revenue)

    // iOS share is derived from the range, so it is available whenever the
    // window covers any OS-attributed impressions at all.
    const osImpressions = toNumber(t.os_impressions)
    const iosSharePct = osImpressions
      ? (toNumber(t.ios_impressions) / osImpressions) * 100
      : 0

    // The split is recomputed from the daily rows rather than read from the
    // bot's once-a-day snapshot. The snapshot has no per-row date, so it could
    // only ever answer the single day it was written for — and it drifts: it
    // was taken at 23:15 on Oct 10 from $4,562.83 of revenue, while
    // adx_daily_stats has since been restated to $4,696.11. Deriving from the
    // same rows as the revenue means applicable + not-applicable always equals
    // the figure shown beside it, for any window.
    const dataDays = toNumber(t.data_days)

    const totalRows = main.rows.length ? toNumber(main.rows[0].total_rows) : 0

    return NextResponse.json({
      dimension,
      count: totalRows,
      page,
      page_size: pageSize,
      results: main.rows.map((r) => {
        const base = {
          impressions: toNumber(r.impressions),
          clicks: toNumber(r.clicks),
          revenue: toNumber(r.revenue),
          ecpm: toNumber(r.ecpm),
          ctr: toNumber(r.ctr),
        }
        if (dimension === 'site') {
          return {
            site: displayDomain(String(r.label), auth.partnerTag),
            label: String(r.label),
            network_code: String(r.network_code),
            account_status: r.account_status ?? null,
            traffic_source_count: toNumber(r.traffic_source_count),
            ...base,
          }
        }
        if (dimension === 'traffic_source') {
          return { traffic_source: r.platform === null ? '(unknown)' : String(r.platform), ...base }
        }
        if (dimension === 'device') {
          return { device: r.os === null ? '(unknown)' : String(r.os), ...base }
        }
        if (dimension === 'country') {
          return { country: r.country === null ? '(unknown)' : String(r.country), ...base }
        }
        if (dimension === 'carrier') {
          return { carrier: r.carrier === null ? '(unknown)' : String(r.carrier), ...base }
        }
        if (dimension === 'browser') {
          return { browser: r.browser === null ? '(unknown)' : String(r.browser), ...base }
        }
        if (dimension === 'country_carrier') {
          return {
            country: r.country === null ? '(unknown)' : String(r.country),
            carrier: r.carrier === null ? '(unknown)' : String(r.carrier),
            ...base,
          }
        }
        // overview — one aggregate row
        return base
      }),
      dates: dates.rows.map((r) => toText(r.date)),
      // A trend line needs at least two points; until Ma_bot writes more days
      // the UI must say so rather than draw a single-point line.
      hasHistory: dates.rows.length >= 2,
      range: { from, to, isToday },
      totals: {
        revenue: revenueTotal,
        impressions: totalImpressions,
        clicks: totalClicks,
        ecpm: totalImpressions ? (revenueTotal / totalImpressions) * 1000 : 0,
        ctr: totalImpressions ? (totalClicks / totalImpressions) * 100 : 0,
        totalSites: toNumber(t.total_sites),
        sitesWithData: toNumber(t.sites_with_data),
        sitesEarning: toNumber(t.sites_earning),
        // Derived per-range from adx_os_stats, so it follows the date filter.
        iosSharePct,
        iosShareAvailable: osImpressions > 0,
        // Recomputed from the daily rows, so they follow the date filter too
        // and always sum to the revenue above.
        applicableRevenue: toNumber(t.applicable_revenue),
        notApplicableRevenue: toNumber(t.not_applicable_revenue),
        // False only when the window holds no daily rows at all, so the UI can
        // show a dash rather than implying the split is genuinely zero.
        applicableAvailable: dataDays > 0,
      },
      meta: {
        lastSyncedAt: toText(t.last_synced_at),
        firstDataDate: toText(t.first_data_date),
        lastDataDate: toText(t.last_data_date),
        bytesScanned: totals.bytes + dates.bytes + main.bytes,
      },
    })
  } catch (error) {
    return bigQueryError(error)
  }
}
