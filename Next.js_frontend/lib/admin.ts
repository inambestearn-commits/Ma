import { createClient } from '@/lib/supabase/server'
import { ADMIN_ROLE_KEYS, isAdminRoleKey } from '@/lib/admin-role'

export { ADMIN_ROLE_KEYS, isAdminRoleKey }

/**
 * The admin role is read from `app_metadata.role` on the authenticated user —
 * a field only the service role can write (same trust model as the partner
 * tag in lib/partner.ts). It must never come from the query string, request
 * body, or a cookie.
 *
 * Only GLOBAL roles (super_admin/admin/operations/finance/support) get the
 * admin workspace. Partner-scoped accounts (role `partner`) are rejected here
 * and on the admin login page.
 */

export interface AdminSession {
  userId: string
  email: string
  fullName: string | null
  role: string
}

/** Resolve the signed-in admin. Returns null when there is no session or the
 *  session does not carry an admin role in `app_metadata`. */
export async function getSessionAdmin(): Promise<AdminSession | null> {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null

  const role = (user.app_metadata ?? {}).role
  if (!isAdminRoleKey(role)) return null

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>

  return {
    userId: user.id,
    email: user.email ?? '',
    fullName: typeof meta.full_name === 'string' ? meta.full_name : null,
    role: String(role).trim().toUpperCase(),
  }
}
