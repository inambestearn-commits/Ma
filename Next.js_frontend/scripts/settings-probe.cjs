const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function main() {
  const sb = createClient(SUPA, ANON, { auth: { persistSession: false } })
  const { data, error } = await sb.auth.signInWithPassword({
    email: 'pt-23@adglobex.test',
    password: 'Partner!2026',
  })
  if (error) { console.error('sign-in failed', error.message); process.exit(1) }

  console.log('user_metadata BEFORE:', JSON.stringify(data.user.user_metadata))
  console.log('app_metadata BEFORE:', JSON.stringify(data.user.app_metadata))

  // 1. Can the user update their own user_metadata (display name + prefs)?
  const upd = await sb.auth.updateUser({
    data: {
      full_name: 'Northstar Publishing',
      company_name: 'Northstar Publishing Ltd',
      notification_prefs: { payment: true, policy: true, digest: false },
    },
  })
  console.log('\nupdateUser(user_metadata):', upd.error ? 'FAILED ' + upd.error.message : 'OK')
  if (!upd.error) {
    console.log('  user_metadata AFTER:', JSON.stringify(upd.data.user?.user_metadata))
    console.log('  app_metadata unchanged:', JSON.stringify(upd.data.user?.app_metadata))
  }

  // 2. Re-read via a fresh sign-in to prove it persisted server-side.
  const sb2 = createClient(SUPA, ANON, { auth: { persistSession: false } })
  const { data: fresh } = await sb2.auth.signInWithPassword({ email: 'pt-23@adglobex.test', password: 'Partner!2026' })
  console.log('\nre-read user_metadata:', JSON.stringify(fresh.user.user_metadata))
  console.log('re-read app_metadata:', JSON.stringify(fresh.user.app_metadata))

  // 3. Confirm app_metadata still cannot be self-modified (the isolation guarantee).
  const bad = await sb.auth.updateUser({ app_metadata: { partner_tag: 'pt-24' } })
  console.log('\nself-modify app_metadata:', bad.error ? 'BLOCKED ' + bad.error.message : 'ALLOWED <-- SECURITY BUG')
  console.log('tag still:', JSON.stringify(fresh.user.app_metadata.partner_tag))

  // 4. Password update round-trip: change then change back.
  const pw = await sb.auth.updateUser({ password: 'Partner!2026' })
  console.log('\nupdateUser(password) same-password:', pw.error ? 'FAILED ' + pw.error.message : 'OK')
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
