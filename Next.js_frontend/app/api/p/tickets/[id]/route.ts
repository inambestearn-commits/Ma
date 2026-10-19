import { NextRequest, NextResponse } from 'next/server'
import { bigQueryError, requirePartner } from '@/lib/api-partner'
import { getTicket, listHistory, listMessages } from '@/lib/ticket-store'

export const dynamic = 'force-dynamic'

/**
 * One ticket with its full conversation and audit trail.
 *
 * `getTicket` is scoped by the session's partner tag, so a ticket belonging to
 * a different tag reads as not-found rather than leaking its existence.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePartner()
  if (auth instanceof NextResponse) return auth

  const { id } = await params
  const ticketId = id.trim().slice(0, 40)

  try {
    const ticket = await getTicket(auth.partnerTag, ticketId)
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }
    const [messages, history] = await Promise.all([
      listMessages(auth.partnerTag, ticketId),
      listHistory(auth.partnerTag, ticketId),
    ])
    return NextResponse.json({ ticket, messages, history })
  } catch (error) {
    return bigQueryError(error)
  }
}
