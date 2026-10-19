/**
 * Admin role predicate — pure, dependency-free, so it can be imported from
 * client components, proxy.ts, and server code alike (no next/headers).
 *
 * Only GLOBAL roles (super_admin/admin/operations/finance/support) get the
 * admin workspace. The value always comes from `app_metadata.role`, which
 * only the service role can write.
 */

export const ADMIN_ROLE_KEYS = ['super_admin', 'admin', 'operations', 'finance', 'support']

export function isAdminRoleKey(raw: unknown): boolean {
  if (typeof raw !== 'string') return false
  return ADMIN_ROLE_KEYS.includes(raw.trim().toLowerCase())
}
