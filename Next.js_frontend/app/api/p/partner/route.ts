import { NextResponse } from 'next/server'
import { bigQueryError, requirePartner } from '@/lib/api-partner'
import { getPartnerRecord } from '@/lib/bq'
import { getSubPartnerByTag } from '@/lib/sub-partners'

export const dynamic = 'force-dynamic'

/**
 * The signed-in partner's own record.
 *
 * The value the client actually needs is `minParentShare` — the floor the
 * publisher form's revenue share cannot go below. It comes from whoever
 * provisioned the account:
 *
 *   - parent partner: `partners.max_revenue_share` (admin-set). A value ≤ 50 is
 *     the partner's minimum parent cut; > 50 is the child publisher's max, so
 *     the floor is its complement.
 *   - sub-partner: `sub_partners.revenue_share`, the parent share its own
 *     partner set when creating it. Sub-partners have no row in `partners`, so
 *     without this branch the form would fall back to 1%.
 *
 * The rest is returned so a page does not need a second round trip. An
 * unlinked account gets an empty floor rather than an error: the portal shell
 * still works for them, and the submit endpoint is where being unlinked is
 * actually refused.
 */
export async function GET() {
  const auth = await requirePartner()
  if (auth instanceof NextResponse) return auth

  try {
    const record = await getPartnerRecord(auth.partnerTag)

    if (!record) {
      const sub = await getSubPartnerByTag(auth.partnerTag)
      return NextResponse.json({
        partnerTag: auth.partnerTag,
        name: sub?.name ?? auth.fullName,
        status: sub?.status ?? null,
        maxRevenueShare: null,
        minParentShare: sub ? Math.min(99, Math.max(1, Math.round(sub.revenueShare))) : null,
        isSubPartner: Boolean(sub),
      })
    }

    const raw = record.max_revenue_share
    const cap =
      typeof raw === 'number' && Number.isFinite(raw) && raw > 0
        ? Math.min(100, Math.round(raw))
        : null
    const minParentShare =
      cap === null ? null : cap > 50 ? Math.max(1, 100 - cap) : cap

    return NextResponse.json({
      partnerTag: auth.partnerTag,
      name: record.name,
      status: record.status,
      maxRevenueShare: cap,
      minParentShare,
      isSubPartner: false,
    })
  } catch (error) {
    return bigQueryError(error)
  }
}
