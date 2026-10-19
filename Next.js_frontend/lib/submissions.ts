import { randomBytes } from 'node:crypto'
import { appTable, PARTNER_SITES_CTE, runQuery, table, toNumber, toText } from '@/lib/bq'

/**
 * Partner publisher submissions.
 *
 * Every attempt — including the ones blocked as duplicates — is recorded. A
 * blocked attempt is otherwise invisible: the partner is told to contact the
 * admin, and nothing is left for the admin to act on.
 *
 * Isolation is the same as everywhere else in the portal: the tag comes from
 * the session and is bound as @partner_tag. It is never read from the body.
 */

const TABLE = () => table('partner_submission_requests')

export const newRequestId = () =>
  `REQ-${randomBytes(5).toString('hex').toUpperCase()}`

/**
 * The child's share as a whole percent -> the PARENT's share in millipercent.
 *
 * Everything downstream treats `revenue_share_millipercent` as the parent's
 * cut: GAM's proposedRevenueShareMillipercent pays the parent from it (child
 * 95 stored as 95000 came back as "parent 95 / child 5"), the sync round-trips
 * GAM's approved value into the same column, and the dashboard's
 * "Gross Parent Total" multiplies it into revenue. Only the slider speaks in
 * the child's language, so the inversion happens exactly here: child 95 ->
 * parent 5 -> 5000.
 *
 * The admin sets `max_revenue_share` on the partner record and the form's
 * slider is bounded by it; this only does the unit conversion, the ceiling is
 * enforced by the caller so the rejection message can name it.
 */
export const childShareToParentMillipercent = (childShare: number): number | null => {
  if (!Number.isFinite(childShare)) return null
  const pct = Math.round(childShare)
  if (pct < 1 || pct > 100) return null
  return (100 - pct) * 1000
}

export interface SubmissionInput {
  requestId: string
  partnerTag: string
  partnerEmail: string | null
  partnerName: string | null
  partnerUserId: string | null
  site: string
  childName: string
  gamEmail: string
  networkCode: string
  revenueShareMillipercent: number
  delegationType: string
  note: string | null
}

export interface SubmissionRow extends SubmissionInput {
  status: string
  reason: string | null
  existingPartnerTag: string | null
  existingLabel: string | null
  gamCompanyId: string | null
  gamInvitationStatus: string | null
  errorMessage: string | null
  createdAt: string | null
}

/**
 * Look up a network code across the whole inventory — deliberately NOT scoped
 * to the caller. The point of the check is to catch codes already held by
 * anyone, including the caller's own partner tag.
 *
 * The holder's tag is recovered from the label in two branches: a legacy
 * `<domain>/<TAG>` label still splits on the slash; a label without a slash is
 * the new `<TAG>-<domain>` form, whose tag is matched against
 * `ma_new_data.partners` (exact ticket or `ticket-` prefix, longest wins) —
 * tags contain hyphens themselves, so no rule can split a label on a hyphen
 * without knowing which tickets exist.
 */
export async function findNetworkCode(networkCode: string): Promise<{
  networkCode: string
  label: string
  accountStatus: string
  partnerTag: string
} | null> {
  const { rows } = await runQuery<{
    network_code: string
    label: string
    account_status: string
  }>(
    `SELECT network_code, label, account_status
     FROM ${table('network_codes')}
     WHERE network_code = @network_code
     LIMIT 1`,
    { network_code: networkCode },
  )
  const r = rows[0]
  if (!r) return null
  const label = String(r.label ?? '')

  let partnerTag = ''
  if (label.includes('/')) {
    partnerTag = label.slice(label.lastIndexOf('/') + 1).toLowerCase()
  } else if (label) {
    const { rows: holders } = await runQuery<{ partner_ticket: string }>(
      `SELECT LOWER(partner_ticket) AS partner_ticket
       FROM ${appTable('partners')}
       WHERE LOWER(@label) = LOWER(partner_ticket)
          OR STARTS_WITH(LOWER(@label), LOWER(partner_ticket) || '-')
       ORDER BY LENGTH(partner_ticket) DESC
       LIMIT 1`,
      { label },
    )
    partnerTag = String(holders[0]?.partner_ticket ?? '')
  }

  return {
    networkCode: String(r.network_code),
    label,
    accountStatus: String(r.account_status ?? ''),
    partnerTag,
  }
}

export async function insertSubmission(
  input: SubmissionInput & {
    status: string
    reason: string
    existingPartnerTag?: string | null
    existingLabel?: string | null
    gamCompanyId?: string | null
    gamInvitationStatus?: string | null
    errorMessage?: string | null
  },
): Promise<void> {
  const now = new Date().toISOString()

  // Nullable params are bound as '' and turned into SQL NULL with NULLIF, the
  // same convention as ticket-store. The driver refuses a bare JS null — it
  // cannot infer a column type from it — and a typed-null map is far more
  // ceremony than this needs.
  const text = (v: string | null | undefined) => v ?? ''

  await runQuery(
    `INSERT INTO ${TABLE()}
       (request_id, partner_tag, partner_email, partner_name, partner_user_id,
        site, child_name, gam_email, network_code, revenue_share_millipercent,
        delegation_type, note, status, reason, existing_partner_tag, existing_label,
        gam_company_id, gam_invitation_status, error_message, created_at, updated_at)
     VALUES
       (@request_id, @partner_tag,
        NULLIF(@partner_email, ''), NULLIF(@partner_name, ''), NULLIF(@partner_user_id, ''),
        @site, @child_name, @gam_email, @network_code, @revenue_share_millipercent,
        @delegation_type, NULLIF(@note, ''), @status, @reason,
        NULLIF(@existing_partner_tag, ''), NULLIF(@existing_label, ''),
        NULLIF(@gam_company_id, ''), NULLIF(@gam_invitation_status, ''), NULLIF(@error_message, ''),
        SAFE_CAST(@created_at AS TIMESTAMP), SAFE_CAST(@updated_at AS TIMESTAMP))`,
    {
      request_id: input.requestId,
      partner_tag: input.partnerTag,
      partner_email: text(input.partnerEmail),
      partner_name: text(input.partnerName),
      partner_user_id: text(input.partnerUserId),
      site: input.site,
      child_name: input.childName,
      gam_email: input.gamEmail,
      network_code: input.networkCode,
      revenue_share_millipercent: input.revenueShareMillipercent,
      delegation_type: input.delegationType,
      note: text(input.note),
      status: input.status,
      reason: input.reason,
      existing_partner_tag: text(input.existingPartnerTag),
      existing_label: text(input.existingLabel),
      gam_company_id: text(input.gamCompanyId),
      gam_invitation_status: text(input.gamInvitationStatus),
      error_message: text(input.errorMessage),
      created_at: now,
      updated_at: now,
    },
  )
}

/**
 * Admin view: every submission across all partners, newest first.
 *
 * The whole point of recording blocked duplicates is that the admin can act
 * on them. `status: 'unread'` is the action queue; `failed` is a GAM error
 * that already told the partner to contact support.
 */
export async function listAllSubmissions(limit = 100) {
  const { rows } = await runQuery(
    `SELECT
       request_id, partner_tag, partner_email, partner_name, partner_user_id,
       site, child_name, gam_email, network_code, revenue_share_millipercent,
       delegation_type, note, status, reason, existing_partner_tag, existing_label,
       gam_company_id, gam_invitation_status, error_message, created_at, updated_at
     FROM ${TABLE()}
     ORDER BY created_at DESC
     LIMIT @limit`,
    { limit },
  )

  return rows.map((r) => ({
    requestId: String(r.request_id),
    partnerTag: String(r.partner_tag ?? ''),
    partnerEmail: r.partner_email == null ? null : String(r.partner_email),
    partnerName: r.partner_name == null ? null : String(r.partner_name),
    partnerUserId: r.partner_user_id == null ? null : String(r.partner_user_id),
    site: String(r.site ?? ''),
    childName: String(r.child_name ?? ''),
    gamEmail: String(r.gam_email ?? ''),
    networkCode: String(r.network_code ?? ''),
    revenueShareMillipercent: toNumber(r.revenue_share_millipercent),
    delegationType: String(r.delegation_type ?? ''),
    note: r.note == null ? null : String(r.note),
    status: String(r.status ?? ''),
    reason: r.reason == null ? null : String(r.reason),
    existingPartnerTag: r.existing_partner_tag == null ? null : String(r.existing_partner_tag),
    existingLabel: r.existing_label == null ? null : String(r.existing_label),
    gamCompanyId: r.gam_company_id == null ? null : String(r.gam_company_id),
    gamInvitationStatus: r.gam_invitation_status == null ? null : String(r.gam_invitation_status),
    errorMessage: r.error_message == null ? null : String(r.error_message),
    createdAt: toText(r.created_at),
    updatedAt: toText(r.updated_at),
  }))
}

/**
 * One partner's own submissions. The CTE is carried alongside the main query so
 * a partner with zero sites still gets their own request history back — the
 * whole reason a submission lands here is that it was blocked.
 */
export async function listSubmissions(partnerTag: string) {
  const { rows } = await runQuery(
    `WITH ${PARTNER_SITES_CTE}
     SELECT
       request_id, site, child_name, gam_email, network_code,
       revenue_share_millipercent, delegation_type, note, status, reason,
       existing_partner_tag, existing_label, gam_invitation_status,
       error_message, created_at, updated_at
     FROM ${TABLE()}
     WHERE partner_tag = @partner_tag
     ORDER BY created_at DESC
     LIMIT 200`,
    { partner_tag: partnerTag },
  )

  return rows.map((r) => ({
    requestId: String(r.request_id),
    site: String(r.site ?? ''),
    childName: String(r.child_name ?? ''),
    gamEmail: String(r.gam_email ?? ''),
    networkCode: String(r.network_code ?? ''),
    revenueShareMillipercent: toNumber(r.revenue_share_millipercent),
    delegationType: String(r.delegation_type ?? ''),
    note: r.note === null || r.note === undefined ? null : String(r.note),
    status: String(r.status ?? ''),
    reason: r.reason === null || r.reason === undefined ? null : String(r.reason),
    existingPartnerTag:
      r.existing_partner_tag === null || r.existing_partner_tag === undefined
        ? null
        : String(r.existing_partner_tag),
    existingLabel:
      r.existing_label === null || r.existing_label === undefined ? null : String(r.existing_label),
    gamInvitationStatus:
      r.gam_invitation_status === null || r.gam_invitation_status === undefined
        ? null
        : String(r.gam_invitation_status),
    errorMessage:
      r.error_message === null || r.error_message === undefined ? null : String(r.error_message),
    createdAt: toText(r.created_at),
    updatedAt: toText(r.updated_at),
  }))
}
