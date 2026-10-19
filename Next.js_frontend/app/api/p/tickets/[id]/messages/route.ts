import { NextRequest, NextResponse } from 'next/server'
import { bigQueryError, requirePartner } from '@/lib/api-partner'
import { addPartnerMessage } from '@/lib/ticket-store'

export const dynamic = 'force-dynamic'

const MAX_BODY = 8000

/** Appends a partner reply to their own ticket. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePartner()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const ticketId = id.trim().slice(0, 40)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const message = String(body.body ?? body.message ?? '').trim()
  if (!message) {
    return NextResponse.json({ error: 'Write a message before sending' }, { status: 400 })
  }
  if (message.length > MAX_BODY) {
    return NextResponse.json(
      { error: `Keep the message under ${MAX_BODY} characters` },
      { status: 400 },
    )
  }

  try {
    const result = await addPartnerMessage({
      partnerTag: auth.partnerTag,
      ticketId,
      userId: auth.userId,
      name: auth.fullName,
      email: auth.email,
      body: message,
    })
    if (!result.ok) {
      return NextResponse.json(
        { error: 'This ticket is closed. File a new ticket to start a fresh thread.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ ok: true, reopened: result.reopened }, { status: 201 })
  } catch (error) {
    return bigQueryError(error)
  }
}
