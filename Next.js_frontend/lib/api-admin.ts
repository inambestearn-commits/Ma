import { NextResponse } from 'next/server'
import { getSessionAdmin } from '@/lib/admin'

/**
 * Resolves the authenticated admin inside a route handler.
 * Returns either the session or a 401/403 response.
 */
export async function requireAdmin() {
  const admin = await getSessionAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  return admin
}

/** Normalizes a BigQuery failure into a client-safe 502. */
export function bigQueryError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'Query failed'
  console.error('[admin-api] bigquery error:', message)
  return NextResponse.json(
    { error: 'Data is temporarily unavailable' },
    { status: 502 },
  )
}
