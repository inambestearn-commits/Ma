import { NextResponse } from 'next/server'
import { getSessionPartner, type PartnerSession } from '@/lib/partner'

/**
 * Resolves the authenticated partner inside a route handler.
 * Returns either the session or a 401 response, so handlers stay terse:
 *
 *   const auth = await requirePartner()
 *   if (auth instanceof NextResponse) return auth
 */
export async function requirePartner(): Promise<PartnerSession | NextResponse> {
  const partner = await getSessionPartner()
  if (!partner) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  return partner
}

/** Normalizes a BigQuery failure into a client-safe 502. */
export function bigQueryError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'Reporting query failed'
  console.error('[partner-api] bigquery error:', message)
  return NextResponse.json({ error: 'Reporting data is temporarily unavailable' }, { status: 502 })
}
