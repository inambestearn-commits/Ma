const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const BASE = 'http://localhost:3000'
const EMAIL = 'pt-24ak@adglobex.test'
const TAG = 'pt-24ak'

let failures = 0
const check = (ok, label, detail = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

async function signIn() {
  const sb = createClient(SUPA, ANON, { auth: { persistSession: false } })
  const { data, error } = await sb.auth.signInWithPassword({ email: EMAIL, password: 'Partner!2026' })
  if (error) throw new Error('sign-in failed: ' + error.message)
  const ref = new URL(SUPA).hostname.split('.')[0]
  const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(data.session)).toString('base64')}`
  return { sb, user: data.user, headers: { cookie } }
}

async function main() {
  console.log('=== 1. SETTINGS PAGE ===')
  const { sb, user, headers } = await signIn()

  const res = await fetch(`${BASE}/p/settings`, { headers })
  const html = await res.text()
  const text = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  check(res.status === 200, '/p/settings renders 200', `status=${res.status} bytes=${html.length}`)
  check(text.includes('Change password'), 'has Change password panel')
  check(text.includes('Sign out everywhere'), 'has Sign out everywhere')
  check(text.includes('What we email you about'), 'has notifications panel')
  check(text.includes(TAG.toUpperCase()), 'shows partner tag', TAG)
  check(/class="settings-page"/.test(html), 'wrapped in .settings-page (width cap)')
  // The app_metadata explainer the user asked to remove must be gone.
  check(!/app_metadata/.test(text), 'app_metadata note removed')
  check(!/widen the set of sites/.test(text), 'isolation explainer removed')

  console.log('\n=== 2. PROFILE PERSISTS ===')
  const newName = `QA Name ${Date.now()}`
  const newCompany = `QA Co ${Date.now()}`
  const upd = await sb.auth.updateUser({ data: { full_name: newName, company_name: newCompany } })
  check(!upd.error, 'updateUser(profile) succeeds', upd.error?.message)

  const fresh1 = await signIn()
  check(fresh1.user.user_metadata.full_name === newName, 'full_name persisted server-side',
    fresh1.user.user_metadata.full_name)
  check(fresh1.user.user_metadata.company_name === newCompany, 'company_name persisted server-side',
    fresh1.user.user_metadata.company_name)

  // The name must also reach the partner shell, which reads it server-side.
  const page = await (await fetch(`${BASE}/p`, { headers: fresh1.headers })).text()
  const pageText = page.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  check(pageText.includes(newName), 'sidebar/topbar shows the new display name', newName)

  console.log('\n=== 3. NOTIFICATION PREFS PERSIST ===')
  const target = { payment: false, policy: true, smartAlert: false, invite: true, withdrawn: true, mcm: false, digest: true }
  const updPrefs = await sb.auth.updateUser({ data: { notification_prefs: target } })
  check(!updPrefs.error, 'updateUser(notification_prefs) succeeds', updPrefs.error?.message)

  const fresh2 = await signIn()
  const gotPrefs = fresh2.user.user_metadata.notification_prefs ?? {}
  // Supabase returns keys alphabetised, so compare per key rather than by JSON string.
  const prefsMatch = Object.keys(target).every((k) => gotPrefs[k] === target[k])
  check(prefsMatch, 'notification_prefs persisted', JSON.stringify(gotPrefs))

  console.log('\n=== 4. ISOLATION INTACT ===')
  check(fresh2.user.app_metadata.partner_tag === TAG, 'partner_tag unchanged after saves',
    fresh2.user.app_metadata.partner_tag)
  const bad = await sb.auth.updateUser({ app_metadata: { partner_tag: 'pt-24' } })
  check(!!bad.error, 'self-modify app_metadata still blocked', bad.error?.message)

  console.log('\n=== 5. SIGN OUT EVERYWHERE ===')
  const g = await sb.auth.signOut({ scope: 'global' })
  check(!g.error, 'signOut global succeeds', g.error?.message)
  const after = await sb.auth.getSession()
  check(!after.data.session, 'session cleared after global sign-out')

  // Restore demo defaults so the account isn't left holding QA values.
  const restore = await signIn()
  await restore.sb.auth.updateUser({
    data: {
      full_name: 'Kavitha IX',
      company_name: null,
      notification_prefs: { payment: true, policy: true, smartAlert: true, invite: true, withdrawn: false, mcm: true, digest: false },
    },
  })
  console.log('\n  (restored demo defaults)')

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
