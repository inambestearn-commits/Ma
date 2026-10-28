import { NextRequest, NextResponse } from 'next/server'
import { bigQueryError, requirePartner } from '@/lib/api-partner'
import { getPartnerRecord } from '@/lib/bq'
import {
  buildSubTag,
  buildSubTicket,
  countSubPartners,
  insertSubPartner,
  isSubPartnerTag,
  listSubPartners,
  newSubPartnerId,
} from '@/lib/sub-partners'
import { createServiceClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/* --------------------------------- GET ----------------------------------- */

export async function GET() {
  const auth = await requirePartner()
  if (auth instanceof NextResponse) return auth

  try {
    if (await isSubPartnerTag(auth.partnerTag)) {
      return fail('Sub partners cannot manage sub partners', 403)
    }
    const subPartners = await listSubPartners(auth.partnerTag)
    return NextResponse.json({ subPartners })
  } catch (error) {
    return bigQueryError(error)
  }
}

/* --------------------------------- POST ---------------------------------- */

export async function POST(request: NextRequest) {
  const auth = await requirePartner()
  if (auth instanceof NextResponse) return auth

  /* ── only a parent partner may create sub-partners ── */
  try {
    if (await isSubPartnerTag(auth.partnerTag)) {
      return fail('Sub partners cannot create sub partners', 403)
    }
  } catch (error) {
    return bigQueryError(error)
  }

  /* ── parse body ── */
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return fail('Invalid JSON body', 400)
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const revenueShare =
    typeof body.revenueShare === 'number' ? Math.round(body.revenueShare) : Number.NaN

  /* ── validate ── */
  if (!name) return fail('Name is required', 400)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Invalid email address', 400)
  if (!password || password.length < 8) return fail('Password must be at least 8 characters', 400)
  if (Number.isNaN(revenueShare)) return fail('Revenue share must be a number', 400)
  if (revenueShare < 1 || revenueShare > 99) return fail('Revenue share must be between 1 and 99', 400)

  /* ── enforce the parent's own minimum share ── */
  try {
    const record = await getPartnerRecord(auth.partnerTag)
    const rawCap = record?.max_revenue_share
    if (typeof rawCap === 'number' && Number.isFinite(rawCap) && rawCap > 0) {
      const minParentShare = rawCap <= 50 ? Math.round(rawCap) : Math.max(1, 100 - Math.round(rawCap))
      if (revenueShare < minParentShare) {
        return fail(
          `Revenue share cannot be less than ${minParentShare}% for this account.`,
          403,
        )
      }
    }
  } catch (error) {
    return bigQueryError(error)
  }

  /* ── derive ticket / tag ── */
  let seq: number
  try {
    const existing = await countSubPartners(auth.partnerTag)
    seq = existing + 1
  } catch (error) {
    return bigQueryError(error)
  }

  const parentTicket = auth.partnerTag.toUpperCase()
  const subTicket = buildSubTicket(parentTicket, seq)   // e.g. "AHQ/01"
  const subTag = buildSubTag(parentTicket, seq)          // e.g. "ahq-01"

  /* ── create Supabase auth user ── */
  const supabase = createServiceClient()
  let authUserId: string | null = null

  const { data: userData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      partner_tag: subTag,
      parent_tag: auth.partnerTag,
      sub_ticket: subTicket,
    },
    user_metadata: {
      full_name: name,
    },
  })

  if (authError) {
    return fail(`Could not create login account: ${authError.message}`, 422)
  }

  authUserId = userData.user?.id ?? null

  /* ── store in BigQuery ── */
  const subPartnerId = newSubPartnerId()

  try {
    await insertSubPartner({
      subPartnerId,
      parentTag: auth.partnerTag,
      parentTicket,
      subTicket,
      subTag,
      name,
      email,
      revenueShare,
      authUserId,
    })
  } catch (error) {
    // BigQuery insert failed — clean up the Supabase user so the state stays consistent
    if (authUserId) {
      await supabase.auth.admin.deleteUser(authUserId).catch(() => {})
    }
    return bigQueryError(error)
  }

  return NextResponse.json(
    { subPartnerId, subTicket, subTag, name, email, revenueShare },
    { status: 201 },
  )
}
