import { redirect } from 'next/navigation'
import { PartnerSettings } from '@/components/partner-settings'
import { getSessionPartner } from '@/lib/partner'

export const dynamic = 'force-dynamic'

/**
 * Server component: resolves the session (including user_metadata) so the
 * form renders fully populated on first paint instead of flashing a loading
 * shell and fetching on mount.
 */
export default async function PartnerSettingsPage() {
  const partner = await getSessionPartner()
  if (!partner) redirect('/login')

  return (
    <PartnerSettings
      initial={{
        userId: partner.userId,
        email: partner.email,
        partnerTag: partner.partnerTag,
        fullName: partner.fullName ?? '',
        companyName: partner.companyName ?? '',
        notificationPrefs: partner.notificationPrefs,
        createdAt: partner.createdAt ?? '',
      }}
    />
  )
}
