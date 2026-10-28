import { redirect } from 'next/navigation'
import { getSessionPartner } from '@/lib/partner'
import { isSubPartnerTag } from '@/lib/sub-partners'

export const dynamic = 'force-dynamic'

/**
 * The sub-partner section belongs to parent partners. A sub-partner cannot
 * manage anyone, so a direct visit to these URLs goes back to their home page.
 */
export default async function SubPartnersLayout({ children }: { children: React.ReactNode }) {
  const partner = await getSessionPartner()
  if (!partner) redirect('/login')

  let isSubPartner = false
  try {
    isSubPartner = await isSubPartnerTag(partner.partnerTag)
  } catch {
    isSubPartner = false
  }
  if (isSubPartner) redirect('/p')

  return <>{children}</>
}
