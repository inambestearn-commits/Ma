import { NextRequest, NextResponse } from 'next/server'
import { PARTNER_SITES_CTE, runQuery, table, toNumber } from '@/lib/bq'
import { bigQueryError, requirePartner } from '@/lib/api-partner'
import { displayDomain } from '@/lib/label'

export const dynamic = 'force-dynamic'

interface SiteRow {
  network_code: string
  label: string
  account_status: string | null
  invitation_status: string | null
  approval_status: string | null
  delegation_type: string | null
  revenue_share_millipercent: number | null
  email: string | null
  child_publisher_id: string | null
  revenue: number | null
  impressions: number | null
  clicks: number | null
  ecpm: number | null
  has_stats: boolean
}

const VALID_STATUS = new Set(['ACTIVE', 'INVITED', 'INACTIVE', 'DECLINED'])

/**
 * Which column the `status` filter and the tab counts apply to.
 *
 * The sites page facets on `account_status`. The publishers page facets on
 * `invitation_status`, because that is the lifecycle a partner actually acts
 * on (accept, withdraw, re-invite). Both share one CTE so neither can widen
 * the partner scope.
 */
const VALID_FACET = new Set(['account', 'invitation'])

export async function GET(request: NextRequest) {
  const auth = await requirePartner()
  if (auth instanceof NextResponse) return auth

  const sp = request.nextUrl.searchParams
  const search = (sp.get('search') ?? '').trim().slice(0, 100)
  const rawStatus = (sp.get('status') ?? '').trim().toUpperCase()
  const rawFacet = (sp.get('facet') ?? 'account').trim().toLowerCase()
  const facet = VALID_FACET.has(rawFacet) ? rawFacet : 'account'
  const statusCol = facet === 'invitation' ? 'invitation_status' : 'account_status'
  // The two facets have disjoint vocabularies, so an ACTIVE filter means
  // nothing on the invitation facet and vice versa.
  const status =
    facet === 'invitation'
      ? ['ACCEPTED', 'PENDING', 'WITHDRAWN', 'REJECTED'].includes(rawStatus)
        ? rawStatus
        : null
      : VALID_STATUS.has(rawStatus)
        ? rawStatus
        : null
  const page = Math.max(1, Number(sp.get('page') ?? 1) || 1)
  const pageSize = Math.min(200, Math.max(1, Number(sp.get('page_size') ?? 25) || 25))

  try {
    // Counts are computed from network_codes alone, before any join — a join
    // to adx_daily_stats multiplies rows by platform.
    const countSql = `
      WITH ${PARTNER_SITES_CTE}
      SELECT
        COUNT(*) AS total,
        COUNTIF(${statusCol} = @s1) AS c1,
        COUNTIF(${statusCol} = @s2) AS c2,
        COUNTIF(${statusCol} = @s3) AS c3,
        COUNTIF(${statusCol} = @s4) AS c4,
        COUNTIF(${statusCol} = @status AND LOWER(COALESCE(label, '')) LIKE @like) AS total_matching,
        COUNTIF(LOWER(COALESCE(label, '')) LIKE @like) AS total_search
      FROM partner_sites
    `

    const listSql = `
      WITH ${PARTNER_SITES_CTE},
      site_stats AS (
        SELECT
          network_code,
          SUM(revenue) AS revenue,
          SUM(impressions) AS impressions,
          SUM(clicks) AS clicks,
          SAFE_DIVIDE(SUM(revenue), NULLIF(SUM(impressions), 0)) * 1000 AS ecpm
        FROM ${table('adx_daily_stats')}
        GROUP BY 1
      )
      SELECT
        s.network_code,
        s.label,
        s.account_status,
        s.invitation_status,
        s.approval_status,
        s.delegation_type,
        s.revenue_share_millipercent,
        s.email,
        s.child_publisher_id,
        st.revenue,
        st.impressions,
        st.clicks,
        st.ecpm,
        st.network_code IS NOT NULL AS has_stats
      FROM partner_sites s
      LEFT JOIN site_stats st USING(network_code)
      WHERE LOWER(COALESCE(s.label, '')) LIKE @like
        AND (@status = '' OR s.${statusCol} = @status)
      ORDER BY COALESCE(st.revenue, 0) DESC, s.label
      LIMIT @limit OFFSET @offset
    `

    const like = `%${search.toLowerCase()}%`
    const params = {
      partner_tag: auth.partnerTag,
      like,
      // Empty string rather than null — the driver cannot infer a type for a
      // null parameter, and an empty filter is equivalent to "no status".
      status: status ?? '',
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }

    // The four facet buckets, in the order the UI shows them.
    const buckets =
      facet === 'invitation'
        ? ['ACCEPTED', 'PENDING', 'WITHDRAWN', 'REJECTED']
        : ['ACTIVE', 'INVITED', 'INACTIVE', 'DECLINED']

    const [counts, list] = await Promise.all([
      runQuery(countSql, {
        partner_tag: auth.partnerTag,
        like,
        s1: buckets[0],
        s2: buckets[1],
        s3: buckets[2],
        s4: buckets[3],
        status: status ?? '',
      }),
      runQuery<SiteRow>(listSql, params),
    ])

    const c = counts.rows[0]
    // With a status filter the count is the filtered total; with a search but
    // no status it is every row matching the search, not just the ACTIVE ones.
    const total = status
      ? toNumber(c?.total_matching)
      : search
        ? toNumber(c?.total_search)
        : toNumber(c?.total)

    return NextResponse.json({
      count: total,
      page,
      page_size: pageSize,
      facet,
      counts: {
        total: toNumber(c?.total),
        [buckets[0].toLowerCase()]: toNumber(c?.c1),
        [buckets[1].toLowerCase()]: toNumber(c?.c2),
        [buckets[2].toLowerCase()]: toNumber(c?.c3),
        [buckets[3].toLowerCase()]: toNumber(c?.c4),
      },
      results: list.rows.map((r) => ({
        networkCode: String(r.network_code),
        label: String(r.label),
        domain: displayDomain(String(r.label), auth.partnerTag),
        accountStatus: r.account_status ?? null,
        invitationStatus: r.invitation_status ?? null,
        approvalStatus: r.approval_status ?? null,
        delegationType: r.delegation_type ?? null,
        // `revenue_share_millipercent` is INT64 thousandths of a percent:
        // 10000 = 10%, 5000 = 5%, 20000 = 20%. Divide by 1000, not 10000 —
        // the observed distribution (2000..20000, mode 10000 = the 10% default)
        // confirms the unit.
        revenueSharePct:
          r.revenue_share_millipercent === null
            ? null
            : Math.round((toNumber(r.revenue_share_millipercent) / 1000) * 10) / 10,
        email: r.email ?? null,
        childPublisherId: r.child_publisher_id ?? null,
        revenue: toNumber(r.revenue),
        impressions: toNumber(r.impressions),
        clicks: toNumber(r.clicks),
        ecpm: toNumber(r.ecpm),
        hasStats: Boolean(r.has_stats),
      })),
    })
  } catch (error) {
    return bigQueryError(error)
  }
}
