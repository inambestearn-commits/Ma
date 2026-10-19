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
import { normalizeRange, todayIso } from '@/lib/date'

export const dynamic = 'force-dynamic'

interface SummaryRow {
  total_sites: number
  active_sites: number
  invited_sites: number
  inactive_sites: number
  declined_sites: number
  sites_with_data: number
  sites_earning: number
  data_days: number
  range_revenue: number
  range_impressions: number
  range_clicks: number
  applicable_revenue: number
  not_applicable_revenue: number
  ios_impressions: number
  os_impressions: number
  gross_parent_total: number
  fill_rate: number
  fill_rows: number
  last_synced_at: string | null
}

export async function GET(request: NextRequest) {
  const auth = await requirePartner()
  if (auth instanceof NextResponse) return auth

  // The selected window drives every figure on the home page. It is clamped
  // server-side so a hand-crafted query string cannot widen the range or reach
  // past the last day the warehouse holds.
  const { from, to } = normalizeRange(
    request.nextUrl.searchParams.get('from'),
    request.nextUrl.searchParams.get('to'),
  )
  const isSingleDay = from === to
  const isToday = from === todayIso() && to === todayIso()

  try {
    // Site counts come from network_codes ALONE. Counting across a join to
    // adx_daily_stats would multiply rows by platform and overstate the total
    // (pt-23 reports 79 if joined, but really has 19 active sites).
    //
    // Revenue figures come from adx_daily_stats filtered to the requested
    // window — the only table with per-date granularity. The applicable/not
    // applicable split below is a snapshot the bot writes once per day, so it
    // only answers "today".
    const sql = `
      WITH ${PARTNER_SITES_CTE},
      inventory AS (
        SELECT
          COUNT(*) AS total_sites,
          COUNTIF(account_status = 'ACTIVE') AS active_sites,
          COUNTIF(account_status = 'INVITED') AS invited_sites,
          COUNTIF(account_status = 'INACTIVE') AS inactive_sites,
          COUNTIF(account_status = 'DECLINED') AS declined_sites
        FROM partner_sites
      ),
      range_agg AS (
        SELECT
          COUNT(DISTINCT d.network_code) AS sites_with_data,
          COUNT(DISTINCT IF(COALESCE(d.revenue, 0) > 0, d.network_code, NULL)) AS sites_earning,
          -- Days in the window that actually hold rows, so the UI can tell
          -- "no data here" apart from "the split is genuinely zero".
          COUNT(DISTINCT d.date) AS data_days,
          COALESCE(SUM(d.revenue), 0) AS range_revenue,
          COALESCE(SUM(d.impressions), 0) AS range_impressions,
          COALESCE(SUM(d.clicks), 0) AS range_clicks,
          -- Recomputed from the daily rows rather than read from the once-a-day
          -- snapshot, so the split answers any window and always adds up to
          -- the revenue shown beside it.
          COALESCE(SUM(IF(${NOT_APPLICABLE_PRED('d.platform')}, d.revenue, 0)), 0) AS not_applicable_revenue,
          COALESCE(SUM(IF(NOT ${NOT_APPLICABLE_PRED('d.platform')}, d.revenue, 0)), 0) AS applicable_revenue,
          -- What the parent actually keeps: each site's revenue multiplied by
          -- the share stored on its network_codes row. Sites with no share on
          -- record contribute nothing rather than silently counting as 100%.
          COALESCE(
            SUM(d.revenue * IF(s.revenue_share_millipercent IS NULL, 0, s.revenue_share_millipercent) / 100000),
            0
          ) AS gross_parent_total
        FROM ${table('adx_daily_stats')} d
        JOIN partner_sites s USING(network_code)
        WHERE d.date BETWEEN @from AND @to
      ),
      perf AS (
        SELECT MAX(p.last_synced_at) AS last_synced_at
        FROM ${table('network_code_performance')} p
        JOIN partner_sites s USING(network_code)
      ),
      site_os AS (
        SELECT
          SUM(IF(${IOS_OS_PRED('o.os')}, o.impressions, 0)) AS ios_impressions,
          SUM(o.impressions) AS os_impressions
        FROM ${table('adx_os_stats')} o
        JOIN partner_sites s USING(network_code)
        WHERE o.date BETWEEN @from AND @to
      ),
      fill AS (
        -- Weighted by ad_requests: a simple AVG of the per-row rates would
        -- let a 500-request day outweigh a 500k-request day.
        SELECT
          COALESCE(
            SAFE_MULTIPLY(
              SAFE_DIVIDE(
                SUM(f.ad_requests * f.fill_rate),
                SUM(f.ad_requests)
              ),
              100
            ),
            0
          ) AS fill_rate,
          COUNTIF(f.ad_requests > 0) AS fill_rows
        FROM ${table('adx_fill_stats')} f
        JOIN partner_sites s USING(network_code)
        WHERE f.date BETWEEN @from AND @to
      )
      SELECT
        (SELECT total_sites FROM inventory) AS total_sites,
        (SELECT active_sites FROM inventory) AS active_sites,
        (SELECT invited_sites FROM inventory) AS invited_sites,
        (SELECT inactive_sites FROM inventory) AS inactive_sites,
        (SELECT declined_sites FROM inventory) AS declined_sites,
        (SELECT sites_with_data FROM range_agg) AS sites_with_data,
        (SELECT sites_earning FROM range_agg) AS sites_earning,
        (SELECT data_days FROM range_agg) AS data_days,
        (SELECT range_revenue FROM range_agg) AS range_revenue,
        (SELECT range_impressions FROM range_agg) AS range_impressions,
        (SELECT range_clicks FROM range_agg) AS range_clicks,
        (SELECT applicable_revenue FROM range_agg) AS applicable_revenue,
        (SELECT not_applicable_revenue FROM range_agg) AS not_applicable_revenue,
        (SELECT ios_impressions FROM site_os) AS ios_impressions,
        (SELECT os_impressions FROM site_os) AS os_impressions,
        (SELECT gross_parent_total FROM range_agg) AS gross_parent_total,
        (SELECT fill_rate FROM fill) AS fill_rate,
        (SELECT fill_rows FROM fill) AS fill_rows,
        (SELECT last_synced_at FROM perf) AS last_synced_at
    `

    // Top performers follows the selected window, so the sites listed always
    // match the revenue shown above. Pinning it to the calendar date instead
    // would empty the table on any day the bot has not written yet.
    const topSql = `
      WITH ${PARTNER_SITES_CTE}
      SELECT
        s.label,
        s.network_code,
        s.account_status,
        SUM(d.revenue) AS revenue,
        SUM(d.impressions) AS impressions,
        SUM(d.clicks) AS clicks
      FROM partner_sites s
      JOIN ${table('adx_daily_stats')} d USING(network_code)
      WHERE d.date BETWEEN @from AND @to
      GROUP BY 1, 2, 3
      HAVING revenue > 0
      ORDER BY revenue DESC
      LIMIT 8
    `

    const trendSql = `
      WITH ${PARTNER_SITES_CTE}
      SELECT
        d.date,
        SUM(d.revenue) AS revenue,
        SUM(d.impressions) AS impressions,
        SUM(d.clicks) AS clicks
      FROM ${table('adx_daily_stats')} d
      JOIN partner_sites s USING(network_code)
      WHERE d.date BETWEEN @from AND @to
      GROUP BY 1
      ORDER BY 1
    `

    const params = { partner_tag: auth.partnerTag, from, to }

    const [summary, top, trend] = await Promise.all([
      runQuery<SummaryRow>(sql, params),
      runQuery(topSql, params),
      runQuery(trendSql, params),
    ])

    const s = summary.rows[0]
    const revenue = toNumber(s?.range_revenue)
    const impressions = toNumber(s?.range_impressions)
    const clicks = toNumber(s?.range_clicks)

    // The split is recomputed from the daily rows rather than read from the
    // bot's once-a-day snapshot. Two reasons:
    //
    //  1. The snapshot has no per-row date, so it could only ever answer the
    //     single day it was written for. Recomputing answers any window.
    //  2. It drifts. The snapshot was taken at 23:15 on Oct 10 from $4,562.83
    //     of revenue; adx_daily_stats has since been restated to $4,696.11.
    //     Deriving from the same rows as the revenue means
    //     applicable + not-applicable always equals the figure beside it.
    //
    // The iOS figure is an IMPRESSION share, computed with the bot's own
    // keyword list so the two never disagree. adx_os_stats has no revenue
    // column, so it can never be a share of revenue — hence its own label.
    const dataDays = toNumber(s?.data_days)
    const osImpressions = toNumber(s?.os_impressions)

    return NextResponse.json({
      partner: {
        tag: auth.partnerTag,
        email: auth.email,
        fullName: auth.fullName,
      },
      range: {
        from,
        to,
        isSingleDay,
        isToday,
        sitesEarning: toNumber(s?.sites_earning),
        sitesWithData: toNumber(s?.sites_with_data),
      },
      sites: {
        total: toNumber(s?.total_sites),
        active: toNumber(s?.active_sites),
        invited: toNumber(s?.invited_sites),
        inactive: toNumber(s?.inactive_sites),
        declined: toNumber(s?.declined_sites),
      },
      performance: {
        revenue,
        impressions,
        clicks,
        ecpm: impressions ? (revenue / impressions) * 1000 : 0,
        ctr: impressions ? (clicks / impressions) * 100 : 0,
      },
      split: {
        // False only when the window holds no daily rows at all, so the UI
        // can show a dash instead of implying the split is genuinely zero.
        available: dataDays > 0,
        applicableRevenue: toNumber(s?.applicable_revenue),
        notApplicableRevenue: toNumber(s?.not_applicable_revenue),
        iosImpressionSharePct: osImpressions
          ? (toNumber(s?.ios_impressions) / osImpressions) * 100
          : 0,
        iosImpressionShareAvailable: osImpressions > 0,
      },
      grossParentTotal: toNumber(s?.gross_parent_total),
      fillRate: toNumber(s?.fill_rate),
      // False when the window holds no adx_fill_stats rows — the card can
      // show "no data" instead of implying a genuine 0%.
      fillRateAvailable: toNumber(s?.fill_rows) > 0,
      trend: {
        points: trend.rows.map((r) => ({
          date: toText(r.date),
          revenue: toNumber(r.revenue),
          impressions: toNumber(r.impressions),
          clicks: toNumber(r.clicks),
        })),
        // Fewer than 2 dates means a real trend line cannot be drawn yet.
        hasHistory: trend.rows.length >= 2,
      },
      topSites: top.rows.map((r) => ({
        label: String(r.label),
        domain: displayDomain(String(r.label), auth.partnerTag),
        networkCode: String(r.network_code),
        accountStatus: String(r.account_status ?? ''),
        revenue: toNumber(r.revenue),
        impressions: toNumber(r.impressions),
        clicks: toNumber(r.clicks),
      })),
      meta: {
        lastSyncedAt: toText(s?.last_synced_at),
        bytesScanned: summary.bytes + top.bytes + trend.bytes,
      },
    })
  } catch (error) {
    return bigQueryError(error)
  }
}
