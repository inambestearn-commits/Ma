import { redirect } from 'next/navigation'
import { AppShell } from '@/components/shell'
import { getSessionAdmin } from '@/lib/admin'
import type { DisplayProfile } from '@/lib/api'

export const dynamic = 'force-dynamic'

function initialsOf(name: string, email: string): string {
  const source = name || email.split('@')[0] || ''
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function titleCaseRole(role: string): string {
  return role
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * proxy.ts already gates this route group, but the session is resolved again
 * here so a signed-out request can never render the admin workspace even if
 * the matcher drifts. The resolved identity is passed straight into the shell
 * so the first paint already shows the signed-in admin — no dummy flash.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await getSessionAdmin()
  if (!admin) redirect('/admin/login')

  const fullName = admin.fullName || admin.email.split('@')[0] || 'Admin'
  const profile: DisplayProfile = {
    full_name: fullName,
    email: admin.email,
    role: titleCaseRole(admin.role),
    initials: initialsOf(fullName, admin.email),
    partner_ticket: null,
  }

  return <AppShell profile={profile}>{children}</AppShell>
}
