import { redirect } from 'next/navigation'
import { getSessionPartner } from '@/lib/partner'
import { getPartnerRecord } from '@/lib/bq'
import { PartnerShell } from '@/components/partner-shell'

export const dynamic = 'force-dynamic'

/** Statuses that hard-block portal access. */
const BLOCKED_STATUSES = new Set(['DISABLED', 'SUSPENDED', 'CLOSED'])

/**
 * proxy.ts already gates this route group, but the session is resolved again
 * here so the shell has the partner tag and a signed-out request can never
 * render partner data even if the matcher config drifts.
 *
 * The BQ partner record resolves by partner_ticket and acts as the kill
 * switch: a DISABLED/SUSPENDED/CLOSED partner is bounced to /login. If the
 * identity lookup itself fails (BQ outage) the session remains usable — the
 * portal pages fail independently and a transient error must not lock a
 * healthy partner out of the shell.
 */
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const partner = await getSessionPartner()
  if (!partner) redirect('/login')

  let record: Awaited<ReturnType<typeof getPartnerRecord>> = null
  try {
    record = await getPartnerRecord(partner.partnerTag)
  } catch {
    record = null
  }

  if (record && BLOCKED_STATUSES.has(String(record.status).toUpperCase())) {
    redirect('/login')
  }

  return (
    <PartnerShell
      partner={{
        tag: partner.partnerTag,
        email: partner.email,
        // The signed-in user owns their display name (editable in Settings), so
        // it wins. The BQ partner record is the fallback for accounts that have
        // never set one — its `name` is the partner company, which the user
        // cannot change from the portal.
        fullName: partner.fullName || record?.name || null,
      }}
    >
      {children}
    </PartnerShell>
  )
}
