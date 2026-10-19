/**
 * Seeds ma_new_data.user_profiles + user_roles for the Supabase partner test
 * accounts created by seed-partners.mjs. Without these rows the backend maps
 * the session to AnonymousApplicationPrincipal and every Django endpoint
 * behind IsAuthenticatedAndActive returns 403.
 *
 * Idempotent: deletes prior profile/role rows for the seeded auth ids first.
 */
import { BigQuery } from '@google-cloud/bigquery'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
for (const line of readFileSync(join(here, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const PROJECT = process.env.BIGQUERY_PROJECT_ID
const DATASET = process.env.BIGQUERY_APP_DATASET || 'ma_new_data'
const LOCATION = process.env.BIGQUERY_LOCATION
const BQ_CRED = process.env.BIGQUERY_CREDENTIALS_JSON
const bq = new BigQuery({ projectId: PROJECT, location: LOCATION, ...(BQ_CRED && { credentials: JSON.parse(BQ_CRED) }) })

const T = (name) => `\`${PROJECT}.${DATASET}.${name}\``

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(URL_, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { data, error } = await admin.auth.admin.listUsers()
if (error) {
  console.error('listUsers failed:', error.message)
  process.exit(1)
}
const byEmail = new Map(data.users.map((u) => [u.email, u.id]))

// partner_ticket → partner_id from ma_new_data.partners
const [partnerRows] = await bq.query({
  query: `SELECT partner_id, partner_ticket FROM ${T('partners')}
          WHERE LOWER(partner_ticket) IN ('pt-23','pt-2j','pt-24','pt-24ak')`,
  location: LOCATION,
})
const partnerByTicket = new Map(
  partnerRows.map((r) => [String(r.partner_ticket).toLowerCase(), r.partner_id]),
)

const SEEDS = [
  { email: 'pt-23@adglobex.test', fullName: 'Northstar Publishing', ticket: 'pt-23', role: 'PARTNER_ADMIN' },
  { email: 'pt-2j@adglobex.test', fullName: 'Vertex Labs', ticket: 'pt-2j', role: 'PARTNER_ADMIN' },
  { email: 'pt-24@adglobex.test', fullName: 'Atlas Daily', ticket: 'pt-24', role: 'PARTNER_ADMIN' },
  { email: 'pt-24ak@adglobex.test', fullName: 'Kavitha IX', ticket: 'pt-24ak', role: 'PARTNER_ADMIN' },
]

const now = new Date()

async function main() {
  for (const { email, fullName, ticket, role } of SEEDS) {
    const uid = byEmail.get(email)
    const partnerId = partnerByTicket.get(ticket)
    if (!uid) {
      console.warn(`skip ${email} — not in Supabase`)
      continue
    }
    if (!partnerId) {
      console.warn(`skip ${email} — partner ${ticket} not in ma_new_data.partners`)
      continue
    }

    // Clear prior identity for this auth id (idempotent re-run)
    await bq.query({
      query: `DELETE FROM ${T('user_roles')} WHERE auth_user_id = '${uid}'`,
      location: LOCATION,
    })
    await bq.query({
      query: `DELETE FROM ${T('user_profiles')} WHERE auth_user_id = '${uid}'`,
      location: LOCATION,
    })

    await bq.query({
      query: `INSERT INTO ${T('user_profiles')} (
        auth_user_id, full_name, email, account_status, is_blocked,
        legacy_role, is_active, instant_approval_enabled,
        allowed_revenue_shares_json, website_suffix, created_at, updated_at, row_version
      ) VALUES (
        @uid, @name, @email, 'Active', FALSE,
        NULL, TRUE, FALSE,
        NULL, NULL, @now, @now, 1
      )`,
      location: LOCATION,
      params: { uid, name: fullName, email, now },
    })

    await bq.query({
      query: `INSERT INTO ${T('user_roles')} (
        user_role_id, auth_user_id, role_key, partner_id, status,
        assigned_by_auth_user_id, created_at, updated_at, row_version
      ) VALUES (
        @rid, @uid, @role, @pid, 'ACTIVE',
        NULL, @now, @now, 1
      )`,
      location: LOCATION,
      params: { rid: randomUUID(), uid, role, pid: partnerId, now },
    })

    console.log(`seeded  ${email}  ${role}  partner=${ticket} (${partnerId})`)
  }
}

main().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
