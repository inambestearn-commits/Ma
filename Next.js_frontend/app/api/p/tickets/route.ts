import { NextRequest, NextResponse } from 'next/server'
import { bigQueryError, requirePartner } from '@/lib/api-partner'
import { countTickets, createTicket, listTickets } from '@/lib/ticket-store'
import { isTicketCategory, isTicketPriority } from '@/lib/tickets'

export const dynamic = 'force-dynamic'

const MAX_SUBJECT = 200
const MAX_BODY = 8000

export async function GET(request: NextRequest) {
  const auth = await requirePartner()
  if (auth instanceof NextResponse) return auth

  const sp = request.nextUrl.searchParams
  const page = Math.max(1, Number(sp.get('page') ?? 1) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(sp.get('page_size') ?? 20) || 20))
  const status = (sp.get('status') ?? '').trim().toUpperCase()
  const category = (sp.get('category') ?? '').trim().toUpperCase()
  const search = (sp.get('search') ?? '').trim().slice(0, 100)

  try {
    const [list, counts] = await Promise.all([
      listTickets(auth.partnerTag, { status, category, search, page, pageSize }),
      countTickets(auth.partnerTag),
    ])
    return NextResponse.json({
      count: list.rows.length >= pageSize ? page * pageSize + 1 : (page - 1) * pageSize + list.rows.length,
      page,
      page_size: pageSize,
      counts,
      results: list.rows,
      meta: { bytesScanned: list.bytes, partnerTag: auth.partnerTag },
    })
  } catch (error) {
    return bigQueryError(error)
  }
}

/**
 * Files a new ticket. The partner tag is taken from the session, so a body
 * carrying `partnerTag` is ignored — a partner can only ever file against its
 * own tag.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePartner()
  if (auth instanceof NextResponse) return auth

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const subject = String(body.subject ?? '').trim()
  const description = String(body.description ?? '').trim()
  const category = String(body.category ?? '').trim().toUpperCase()
  const priority = String(body.priority ?? 'NORMAL').trim().toUpperCase()

  const errors: Record<string, string> = {}
  if (!subject) errors.subject = 'A subject is required.'
  else if (subject.length > MAX_SUBJECT) errors.subject = `Keep the subject under ${MAX_SUBJECT} characters.`
  if (!description) errors.description = 'Describe the issue so support can help.'
  else if (description.length > MAX_BODY) errors.description = `Keep the message under ${MAX_BODY} characters.`
  if (!isTicketCategory(category)) errors.category = 'Pick one of the listed categories.'
  if (!isTicketPriority(priority)) errors.priority = 'Pick one of the listed priorities.'

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'Check the highlighted fields', fields: errors }, { status: 400 })
  }

  try {
    const ticketId = await createTicket({
      partnerTag: auth.partnerTag,
      userId: auth.userId,
      name: auth.fullName,
      email: auth.email,
      subject,
      description,
      category: category as never,
      priority: priority as never,
    })
    return NextResponse.json({ ticketId }, { status: 201 })
  } catch (error) {
    return bigQueryError(error)
  }
}
