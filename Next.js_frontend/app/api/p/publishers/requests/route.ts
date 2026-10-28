import { NextRequest, NextResponse } from 'next/server'
import { bigQueryError, requirePartner } from '@/lib/api-partner'
import { getPartnerRecord } from '@/lib/bq'
import { createMCMChild } from '@/lib/gam'
import { getSubPartnerByTag } from '@/lib/sub-partners'
import {
  childShareToParentMillipercent,
  findNetworkCode,
  insertSubmission,
  listSubmissions,
  newRequestId,
} from '@/lib/submissions'

export const dynamic = 'force-dynamic'

/* ------------------------------- validation ------------------------------- */

const DELEGATION_TYPES = ['MANAGE_ACCOUNT', 'MANAGE_INVENTORY']

/** Strip scheme, path, query and trailing dot so `HTTPS://A.com/?x` -> `a.com`. */
function hostOf(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
  const host = withoutScheme.split('/')[0].split('?')[0].split('#')[0]
  return host.replace(/^www\./i, '').replace(/\.$/, '').toLowerCase()
}

/**
 * The label GAM stores, which is also where the partner is read from —
 * `TAG_PREFIX_EXPR` matches the `<TAG>-` that leads the label. Building it as
 * `<PARTNER_TICKET>-<host>` is what makes the new publisher appear under the
 * submitting partner rather than under nobody.
 *
 * The session tag IS the partner_ticket (`ma_new_data.partners.partner_ticket`,
 * e.g. `AGX-44295596`), so a partner is provisioned with their ticket as their
 * Supabase `app_metadata.partner_tag`. Resolving it here rather than trusting
 * the raw session string means a mis-provisioned account is caught instead of
 * silently creating a GAM child that its own dashboard can never see.
 */
function childNameFor(host: string, partnerTicket: string): string {
  return `${partnerTicket.toUpperCase()}-${host}`
}

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/* --------------------------------- POST ---------------------------------- */

export async function POST(request: NextRequest) {
  const auth = await requirePartner()
  if (auth instanceof NextResponse) return auth

  /**
   * The GAM child is named `<TICKET>-<host>`, and the dashboard later reads
   * that ticket back out of the label's leading `TAG-` prefix to scope every
   * report. A parent partner resolves through `partners`; a sub-partner has no
   * row there and resolves through `sub_partners` instead (its own tag is the
   * label prefix, which its parent's queries also match). An account that is
   * neither still gets a clear refusal rather than an invisible onboarding.
   */
  let partnerRecord: Awaited<ReturnType<typeof getPartnerRecord>> = null
  let subPartner: Awaited<ReturnType<typeof getSubPartnerByTag>> = null
  try {
    partnerRecord = await getPartnerRecord(auth.partnerTag)
    if (!partnerRecord) subPartner = await getSubPartnerByTag(auth.partnerTag)
  } catch {
    return bigQueryError(new Error('Partner lookup failed'))
  }
  if (!partnerRecord && !subPartner) {
    return fail('Your account is not linked to a partner record. Contact the admin.', 403)
  }
  if (subPartner && String(subPartner.status).toUpperCase() !== 'ACTIVE') {
    return fail('Your account is not active. Contact your partner.', 403)
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return fail('Invalid request body', 400)
  }

  const site = typeof body.site === 'string' ? body.site.trim().slice(0, 300) : ''
  const gamEmail = typeof body.gamEmail === 'string' ? body.gamEmail.trim().slice(0, 255) : ''
  const networkCode = typeof body.networkCode === 'string' ? body.networkCode.replace(/\D/g, '') : ''
  const delegationType = typeof body.delegationType === 'string' ? body.delegationType.trim() : ''
  // The child's share as a whole percent — the same value the slider holds.
  const childShare = typeof body.childShare === 'number' ? Math.round(body.childShare) : Number.NaN

  if (!site || !gamEmail || !networkCode || !delegationType) {
    return fail('Missing required fields', 400)
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gamEmail)) return fail('Invalid publisher email', 400)
  if (!DELEGATION_TYPES.includes(delegationType)) return fail('Invalid delegation type', 400)

  const millipercent = childShareToParentMillipercent(childShare)
  if (millipercent === null) return fail('Revenue share must be a whole percent between 1 and 100', 400)

  /**
   * The floor comes from whoever provisioned the account:
   *
   *   - parent partner: `partners.max_revenue_share` (admin-set). A value ≤ 50
   *     is the partner's minimum parent cut; > 50 is the child's max share.
   *   - sub-partner: `sub_partners.revenue_share`, the parent share its own
   *     partner set when creating it.
   */
  const parentShare = 100 - childShare
  if (subPartner) {
    const floor = Math.min(99, Math.max(1, Math.round(subPartner.revenueShare)))
    if (parentShare < floor) {
      return fail(`Revenue share cannot be less than ${floor}% for this account. Contact your partner.`, 403)
    }
  } else {
    const rawCap = partnerRecord?.max_revenue_share
    const cap =
      typeof rawCap === 'number' && Number.isFinite(rawCap) && rawCap > 0
        ? Math.min(100, Math.round(rawCap))
        : 100
    if (cap <= 50) {
      if (parentShare < cap) {
        return fail(`Revenue share cannot be less than ${cap}% for this account. Contact the admin.`, 403)
      }
    } else {
      if (childShare > cap) {
        return fail(`Revenue share cannot exceed ${cap}% for this account. Contact the admin.`, 403)
      }
    }
  }

  const host = hostOf(site)
  if (!host || !host.includes('.')) return fail('Invalid site URL', 400)

  const partnerTicket = partnerRecord
    ? String(partnerRecord.partner_ticket).trim()
    : auth.partnerTag
  const childName = childNameFor(host, partnerTicket)
  const requestId = newRequestId()

  const base = {
    requestId,
    partnerTag: auth.partnerTag,
    partnerEmail: auth.email || null,
    partnerName: auth.fullName,
    partnerUserId: auth.userId,
    site: host,
    childName,
    gamEmail,
    networkCode,
    revenueShareMillipercent: millipercent,
    delegationType,
    // The form no longer collects a note; the column stays for the admin.
    note: null,
  }

  try {
    /* ---------------------- duplicate check, before GAM ---------------------- */
    const existing = await findNetworkCode(networkCode)

    if (existing) {
      // Recorded even though nothing was created — this row IS the work item.
      await insertSubmission({
        ...base,
        status: 'unread',
        reason: 'duplicate',
        existingPartnerTag: existing.partnerTag,
        existingLabel: existing.label,
      })
      return fail('This publisher already exists. Contact the admin.', 409)
    }

    /* ---------------------------- create in GAM ---------------------------- */
    try {
      const result = await createMCMChild({
        childNetworkCode: networkCode,
        email: gamEmail,
        displayName: childName,
        proposedDelegationType: delegationType as 'MANAGE_ACCOUNT' | 'MANAGE_INVENTORY',
        proposedRevenueShareMillipercent: millipercent,
      })

      await insertSubmission({
        ...base,
        status: 'submitted',
        reason: 'created',
        gamCompanyId: result.companyId || null,
        gamInvitationStatus: result.invitationStatus || null,
      })

      return NextResponse.json({
        requestId,
        status: 'submitted',
        companyId: result.companyId,
        invitationStatus: result.invitationStatus,
        childName,
      })
    } catch (gamError) {
      // GAM failures are also recorded, so a failed invite is not lost just
      // because the browser was closed.
      const message = gamError instanceof Error ? gamError.message : 'GAM call failed'
      await insertSubmission({
        ...base,
        status: 'failed',
        reason: 'gam_error',
        errorMessage: message.slice(0, 1000),
      }).catch(() => {})
      console.error('[publisher-submit] gam error:', message)
      return fail('The invitation could not be created. Your request has been recorded — please contact the admin.', 502)
    }
  } catch (error) {
    return bigQueryError(error)
  }
}

/* --------------------------------- GET ----------------------------------- */

/** The signed-in partner's own submission history. */
export async function GET() {
  const auth = await requirePartner()
  if (auth instanceof NextResponse) return auth

  try {
    const requests = await listSubmissions(auth.partnerTag)
    return NextResponse.json({ partnerTag: auth.partnerTag, requests })
  } catch (error) {
    return bigQueryError(error)
  }
}
