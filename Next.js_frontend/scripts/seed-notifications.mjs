/**
 * Seeds a handful of test notifications for the partner test accounts.
 * Recipient is the Supabase auth UUID — same id the backend resolves as
 * ApplicationPrincipal.user_id when authenticating a request.
 *
 * Idempotent: deletes prior seed rows (notification_id prefix "seed-") first.
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
const T = `\`${PROJECT}.${DATASET}.notifications\``

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

const SEEDS = [
  {
    email: 'pt-23@adglobex.test',
    partner_id: 'pt-23',
    rows: [
      {
        notification_type: 'policy',
        title: 'IVT threshold exceeded',
        message: 'Invalid traffic on site coastalwire.news hit 4.82% over 24h (threshold 1%).',
        severity: 'CRITICAL',
        is_read: false,
        reference_type: 'policy_issue',
        reference_id: 'pol_01',
      },
      {
        notification_type: 'payment',
        title: 'October statement ready',
        message: 'Your revenue share statement for 2026-09-26 to 2026-10-05 is available.',
        severity: 'INFO',
        is_read: true,
        reference_type: 'statement',
        reference_id: '',
      },
      {
        notification_type: 'site',
        title: 'MCM sync delayed',
        message: 'MCM connection sync for northstar-weekly.com is 7h behind schedule.',
        severity: 'WARNING',
        is_read: false,
        reference_type: 'mcm',
        reference_id: '',
      },
    ],
  },
  {
    email: 'pt-24ak@adglobex.test',
    partner_id: 'pt-24ak',
    rows: [
      {
        notification_type: 'invite',
        title: 'New user invited',
        message: 'ops@kavitha.test was added as a partner user with read-only access.',
        severity: 'INFO',
        is_read: false,
        reference_type: 'partner_user',
        reference_id: '',
      },
      {
        notification_type: 'alert',
        title: 'Geo mix outside contract tier-1 list',
        message: 'Traffic from unexpected regions exceeded 5% on atlasweekend.co.',
        severity: 'WARNING',
        is_read: false,
        reference_type: 'policy_issue',
        reference_id: 'pol_06',
      },
    ],
  },
  {
    email: 'pt-2j@adglobex.test',
    partner_id: 'pt-2j',
    rows: [
      {
        notification_type: 'revenue',
        title: 'Gross parent total updated',
        message: 'Payout calculation for your inventory finished for the current period.',
        severity: 'INFO',
        is_read: false,
        reference_type: 'statement',
        reference_id: '',
      },
    ],
  },
]

async function main() {
  const uids = SEEDS.map((s) => byEmail.get(s.email)).filter(Boolean)
  await bq.query({
    query: `DELETE FROM ${T}
            WHERE notification_id LIKE 'seed-%'
               OR recipient_user_id IN (${uids.map((u) => `'${u}'`).join(', ')})`,
    location: LOCATION,
  })

  let n = 0
  const now = new Date()
  for (const { email, partner_id, rows } of SEEDS) {
    const uid = byEmail.get(email)
    if (!uid) {
      console.warn(`skip ${email} — not in Supabase`)
      continue
    }
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const created = new Date(now.getTime() - (i + 1) * 3600_000 * 6)
      // BigQuery rejects typed nulls via plain object params — use empty string
      // + NULLIF-style handling is not available here, so cast via SQL CASE.
      await bq.query({
        query: `INSERT INTO ${T} (
          notification_id, recipient_user_id, partner_id,
          notification_type, title, message, severity,
          is_read, read_at, reference_type, reference_id, metadata, created_at
        ) VALUES (
          @id, @uid, @pid, @type, @title, @msg, @sev,
          @isRead,
          CASE WHEN @readAt = '' THEN TIMESTAMP(NULL) ELSE CAST(@readAt AS TIMESTAMP) END,
          @refType, @refId, NULL, @created
        )`,
        location: LOCATION,
        params: {
          id: `seed-${randomUUID()}`,
          uid,
          pid: partner_id,
          type: r.notification_type,
          title: r.title,
          msg: r.message,
          sev: r.severity,
          isRead: r.is_read,
          readAt: r.is_read ? created.toISOString() : '',
          refType: r.reference_type,
          refId: r.reference_id,
          created,
        },
      })
      n++
      console.log(`  ${email}  ${r.severity.padEnd(8)}  ${r.title}`)
    }
  }
  console.log(`\nseeded ${n} notifications`)
}

main().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
