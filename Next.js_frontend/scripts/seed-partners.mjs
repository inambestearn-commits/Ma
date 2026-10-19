/**
 * Seeds partner test accounts into Supabase Auth.
 *
 * The partner tag is stored in `app_metadata`, which only the service role can
 * write. Supabase rejects any attempt by a signed-in user to change it
 * themselves, which is what makes the tag trustworthy as the isolation key —
 * a partner cannot re-tag themselves onto someone else's inventory.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-partners.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL from .env.local when not set in the shell.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

for (const line of readFileSync(join(here, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
const PASSWORD = process.env.SEED_PARTNER_PASSWORD ?? 'Partner!2026'

if (!URL_ || !SERVICE) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

/**
 * Each tag must match inventory in BigQuery MA_BOT_DATA.network_codes, where
 * a site's partner is the `<TAG>-` prefix of `label` (`pt-24-yasobe.com`).
 *
 * pt-24 and pt-24ak are intentionally both seeded: they differ only by suffix,
 * so they are the proof that matching stays exact — the delimiter hyphen
 * `pt-24-` never matches `pt-24ak-...`.
 */
const PARTNERS = [
  { email: 'pt-23@adglobex.test', fullName: 'Northstar Publishing', tag: 'pt-23' },
  { email: 'pt-2j@adglobex.test', fullName: 'Vertex Labs', tag: 'pt-2j' },
  { email: 'pt-24@adglobex.test', fullName: 'Atlas Daily', tag: 'pt-24' },
  { email: 'pt-24ak@adglobex.test', fullName: 'Kavitha IX', tag: 'pt-24ak' },
]

const admin = createClient(URL_, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: existing, error: listError } = await admin.auth.admin.listUsers()
if (listError) {
  console.error('Could not list users:', listError.message)
  process.exit(1)
}

const byEmail = new Map(existing.users.map((u) => [u.email, u.id]))

for (const { email, fullName, tag } of PARTNERS) {
  const payload = {
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { partner_tag: tag, role: 'partner' },
    user_metadata: { full_name: fullName },
  }

  const id = byEmail.get(email)
  if (id) {
    const { error } = await admin.auth.admin.updateUserById(id, payload)
    console.log(`${error ? 'FAIL' : 'updated'}  ${email} -> ${tag}`)
    if (error) console.error('   ', error.message)
  } else {
    const { error } = await admin.auth.admin.createUser({ email, ...payload })
    console.log(`${error ? 'FAIL' : 'created'}  ${email} -> ${tag}`)
    if (error) console.error('   ', error.message)
  }
}

console.log(`\nDone. Password for all test accounts: ${PASSWORD}`)
