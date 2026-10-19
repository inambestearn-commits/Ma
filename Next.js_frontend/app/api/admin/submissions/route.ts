import { NextResponse } from 'next/server'
import { bigQueryError, requireAdmin } from '@/lib/api-admin'
import { listAllSubmissions } from '@/lib/submissions'

export const dynamic = 'force-dynamic'

/**
 * Admin listing of every partner publisher-submission request.
 *
 * `status: 'unread'` is the blocked-duplicate action queue — the only trace
 * that attempt ever happened, because the partner was told to contact support
 * and nothing else was created.
 */
export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const requests = await listAllSubmissions()
    return NextResponse.json({ requests })
  } catch (error) {
    return bigQueryError(error)
  }
}
