import { createClient } from '@/lib/supabase/server'
import { DEFAULT_NOTIFICATION_PREFS } from '@/lib/notification-prefs'

export { DEFAULT_NOTIFICATION_PREFS }

/**
 * The partner tag is the single security boundary of this portal.
 *
 * It is read from `app_metadata` on the authenticated user — a field only the
 * service role can write. Supabase rejects any attempt by a user to change it
 * themselves (verified: PUT /auth/v1/user -> 403 not_admin).
 *
 * It must never be accepted from the query string, request body, or a cookie.
 * Every BigQuery call resolves inventory through this value alone.
 */

export interface PartnerSession {
  userId: string
  email: string
  partnerTag: string
  fullName: string | null
  companyName: string | null
  notificationPrefs: Record<string, boolean>
  createdAt: string | null
}

const TAG_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/

/** Normalize a raw tag to the canonical form used in BigQuery labels. */
export function normalizeTag(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const tag = raw.trim().toLowerCase()
  return TAG_PATTERN.test(tag) ? tag : null
}

/**
 * Resolve the signed-in partner. Returns null when there is no session or the
 * session carries no valid partner tag — callers must treat null as 401.
 */
export async function getSessionPartner(): Promise<PartnerSession | null> {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null

  const partnerTag = normalizeTag(user.app_metadata?.partner_tag)
  if (!partnerTag) return null

  // Everything below comes from `user_metadata`, which the user can write
  // themselves. It is display/preference data only — never the partner tag,
  // and never anything that widens the set of sites this session can see.
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const storedPrefs = (meta.notification_prefs as Record<string, boolean> | undefined) ?? {}

  return {
    userId: user.id,
    email: user.email ?? '',
    partnerTag,
    fullName: typeof meta.full_name === 'string' ? meta.full_name : null,
    companyName: typeof meta.company_name === 'string' ? meta.company_name : null,
    notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS, ...storedPrefs },
    createdAt: user.created_at ?? null,
  }
}
