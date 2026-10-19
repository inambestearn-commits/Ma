import { NextResponse } from 'next/server'
import { bigQueryError, requirePartner } from '@/lib/api-partner'
import { getPartnerRecord } from '@/lib/bq'

export const dynamic = 'force-dynamic'

/**
 * The signed-in partner's own record.
 *
 * The only value the client actually needs is `maxRevenueShare` — the ceiling
 * the admin set when the partner was created. The revenue-share slider is
 * bounded by it, so the form has to know it before anything is submitted. The
 * rest is returned so a future page does not need a second round trip.
 *
 * An unlinked account gets an empty cap rather than an error: the portal shell
 * still works for them, and the submit endpoint is where being unlinked is
 * actually refused.
 */
export async function GET() {
  const auth = await requirePartner()
  if (auth instanceof NextResponse) return auth

  try {
    const record = await getPartnerRecord(auth.partnerTag)
    const raw = record?.max_revenue_share
    const maxRevenueShare =
      typeof raw === 'number' && Number.isFinite(raw) && raw > 0
        ? Math.min(100, Math.round(raw))
        : null

    return NextResponse.json({
      partnerTag: auth.partnerTag,
      name: record?.name ?? auth.fullName,
      status: record?.status ?? null,
      maxRevenueShare,
    })
  } catch (error) {
    return bigQueryError(error)
  }
}
