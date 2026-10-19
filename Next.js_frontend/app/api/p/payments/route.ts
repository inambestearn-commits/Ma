import { NextRequest, NextResponse } from 'next/server'
import { PARTNER_SITES_CTE, runQuery, table, toNumber, toText } from '@/lib/bq'
import { bigQueryError, requirePartner } from '@/lib/api-partner'
import { displayDomain } from '@/lib/label'

export const dynamic = 'force-dynamic'

/**
 * Payments for the signed-in partner.
 *
 * Two sources, both partner-scoped through PARTNER_SITES_CTE:
 *  - `mcm_earnings` is the monthly MCM statement per child network code. It is
 *    currently empty in the warehouse, so the route returns an empty list
 *    rather than inventing rows.
 *  - `network_code_performance` carries the live today/week revenue split into
 *    applicable and not-applicable, which is what a partner actually watches
 *    between statements.
 */
export async function GET(_request: NextRequest) {
  const auth = await requirePartner()
  if (auth instanceof NextResponse) return auth

  try {
    const earningsSql = `
      WITH ${PARTNER_SITES_CTE}
      SELECT
        COUNT(*) OVER() AS total_rows,
        m.month,
        m.child_network_code,
        m.child_name,
        m.delegation_type,
        m.total_earnings_micros,
        m.total_earnings_currency_code,
        m.parent_payment_micros,
        m.child_payment_micros,
        m.deductions_micros,
        m.updated_at
      FROM ${table('mcm_earnings')} m
      JOIN partner_sites s ON m.child_network_code = s.network_code
      ORDER BY m.month DESC, m.total_earnings_micros DESC
      LIMIT 100
    `

    const performanceSql = `
      WITH ${PARTNER_SITES_CTE}
      SELECT
        COUNT(*) AS total_sites,
        COUNTIF(p.network_code IS NOT NULL) AS sites_with_data,
        COUNTIF(COALESCE(p.today_impressions, 0) > 0) AS sites_earning,
        COALESCE(SUM(p.today_revenue), 0) AS today_revenue,
        COALESCE(SUM(p.today_impressions), 0) AS today_impressions,
        COALESCE(SUM(p.today_clicks), 0) AS today_clicks,
        COALESCE(SUM(p.week_revenue), 0) AS week_revenue,
        COALESCE(SUM(p.week_impressions), 0) AS week_impressions,
        COALESCE(SUM(p.week_clicks), 0) AS week_clicks,
        COALESCE(SUM(p.today_applicable_revenue), 0) AS today_applicable,
        COALESCE(SUM(p.today_not_applicable_revenue), 0) AS today_not_applicable,
        COALESCE(SUM(p.week_applicable_revenue), 0) AS week_applicable,
        COALESCE(SUM(p.week_not_applicable_revenue), 0) AS week_not_applicable,
        SAFE_DIVIDE(
          SUM(p.week_ios_share_pct * p.week_impressions),
          NULLIF(SUM(p.week_impressions), 0)
        ) AS week_ios_share_pct,
        MAX(p.last_synced_at) AS last_synced_at,
        MAX(p.first_data_date) AS first_data_date
      FROM partner_sites s
      LEFT JOIN ${table('network_code_performance')} p USING(network_code)
    `

    // Top earning sites this week, so the page can show where the balance comes from.
    const topSitesSql = `
      WITH ${PARTNER_SITES_CTE}
      SELECT
        s.label,
        s.network_code,
        s.account_status,
        COALESCE(p.week_revenue, 0) AS week_revenue,
        COALESCE(p.week_impressions, 0) AS week_impressions,
        COALESCE(p.week_applicable_revenue, 0) AS week_applicable,
        COALESCE(p.week_not_applicable_revenue, 0) AS week_not_applicable
      FROM partner_sites s
      LEFT JOIN ${table('network_code_performance')} p USING(network_code)
      ORDER BY week_revenue DESC
      LIMIT 10
    `

    const [earnings, performance, topSites] = await Promise.all([
      runQuery(earningsSql, { partner_tag: auth.partnerTag }),
      runQuery(performanceSql, { partner_tag: auth.partnerTag }),
      runQuery(topSitesSql, { partner_tag: auth.partnerTag }),
    ])

    const p = performance.rows[0] ?? {}
    const microsToCurrency = (micros: unknown, code: unknown) => {
      // MCM reports earnings in micros (1e-6 of the currency unit).
      const amount = toNumber(micros) / 1_000_000
      return { amount, currency: code ? String(code) : 'USD' }
    }

    return NextResponse.json({
      partner: { tag: auth.partnerTag },
      earnings: earnings.rows.map((r) => {
        const total = microsToCurrency(r.total_earnings_micros, r.total_earnings_currency_code)
        return {
          month: String(r.month),
          childNetworkCode: String(r.child_network_code),
          childName: r.child_name === null ? null : String(r.child_name),
          delegationType: r.delegation_type === null ? null : String(r.delegation_type),
          totalEarnings: total.amount,
          currency: total.currency,
          parentPayment: toNumber(r.parent_payment_micros) / 1_000_000,
          childPayment: toNumber(r.child_payment_micros) / 1_000_000,
          deductions: toNumber(r.deductions_micros) / 1_000_000,
          updatedAt: toText(r.updated_at),
        }
      }),
      performance: {
        totalSites: toNumber(p.total_sites),
        sitesWithData: toNumber(p.sites_with_data),
        sitesEarning: toNumber(p.sites_earning),
        today: {
          revenue: toNumber(p.today_revenue),
          impressions: toNumber(p.today_impressions),
          clicks: toNumber(p.today_clicks),
          applicable: toNumber(p.today_applicable),
          notApplicable: toNumber(p.today_not_applicable),
        },
        week: {
          revenue: toNumber(p.week_revenue),
          impressions: toNumber(p.week_impressions),
          clicks: toNumber(p.week_clicks),
          applicable: toNumber(p.week_applicable),
          notApplicable: toNumber(p.week_not_applicable),
          iosSharePct: toNumber(p.week_ios_share_pct),
        },
      },
      topSites: topSites.rows.map((r) => ({
        label: String(r.label),
        domain: displayDomain(String(r.label), auth.partnerTag),
        networkCode: String(r.network_code),
        accountStatus: r.account_status ?? null,
        weekRevenue: toNumber(r.week_revenue),
        weekImpressions: toNumber(r.week_impressions),
        weekApplicable: toNumber(r.week_applicable),
        weekNotApplicable: toNumber(r.week_not_applicable),
      })),
      meta: {
        lastSyncedAt: toText(p.last_synced_at),
        firstDataDate: toText(p.first_data_date),
        bytesScanned: earnings.bytes + performance.bytes + topSites.bytes,
      },
    })
  } catch (error) {
    return bigQueryError(error)
  }
}
