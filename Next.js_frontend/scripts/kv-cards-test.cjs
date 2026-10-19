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

let failures = 0
const check = (ok, label, detail = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const sb = createClient(SUPA, ANON, { auth: { persistSession: false } })
  const { data } = await sb.auth.signInWithPassword({ email: 'pt-23@adglobex.test', password: 'Partner!2026' })
  const ref = new URL(SUPA).hostname.split('.')[0]
  const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(data.session)).toString('base64')}`

  const html = await (await fetch(`${BASE}/p/settings`, { headers: { cookie } })).text()

  console.log('=== ACCOUNT card ===')
  const acct = html.slice(html.indexOf('Workspace identity'), html.indexOf('SESSIONS'))
  check(acct.includes('Partner tag'), 'has Partner tag row')
  check(acct.includes('pt-23@adglobex.test'), 'shows email')
  check(acct.includes('Account created'), 'has Account created row')
  const acctRows = (acct.match(/kv-row/g) || []).length
  check(acctRows === 5, 'ACCOUNT renders 5 kv-rows', `found ${acctRows}`)

  console.log('\n=== SESSIONS card ===')
  // SECURITY/Change password renders before SESSIONS in the DOM, so slice to the
  // end of the settings page rather than to 'Change password'.
  const sess = html.slice(html.indexOf('Signed-in devices'), html.indexOf('</main>') > 0 ? html.indexOf('</main>') : html.length)
  check(sess.includes('This device'), 'has This device row')
  check(sess.includes('All devices are revoked'), 'has Scope row')
  const sessRows = (sess.match(/kv-row/g) || []).length
  check(sessRows === 2, 'SESSIONS renders 2 kv-rows', `found ${sessRows}`)
  check(sess.includes('form-note'), 'has explainer note')
  check(sess.includes('Sign out everywhere'), 'has sign out button')

  console.log('\n=== Served CSS stacking rule ===')
  const cssUrl = (html.match(/\/_next\/static\/[^"]+\.css/g) || [])[0]
  check(Boolean(cssUrl), 'found a CSS chunk link', cssUrl)
  if (cssUrl) {
    const css = await (await fetch(`${BASE}${cssUrl}`)).text()
    const m = css.match(/\.settings-page \.kv\s*\{[^}]*\}/)
    check(Boolean(m) && /grid-template-columns:\s*1fr/.test(m[0]), 'CSS forces .kv single column', m && m[0].trim())
    const r = css.match(/\.settings-page \.kv-row\s*\{[^}]*\}/)
    check(Boolean(r) && /grid-template-columns:\s*1fr/.test(r[0]), 'CSS stacks .kv-row label above value', r && r[0].trim())
    const dt = css.match(/\.settings-page \.kv-row dt\s*\{[^}]*\}/)
    check(Boolean(dt), 'CSS styles the dt label', dt && dt[0].trim())
    // The cap must ship with centering. .content-wrap is max-width:none, so a
    // capped block child without margin-inline:auto sits flush left and leaves a
    // dead gutter across a large laptop screen.
    const page = css.match(/\.settings-page\s*\{[^}]*\}/)
    check(Boolean(page) && /max-width:\s*\d+px/.test(page[0]) && /margin-inline:\s*auto/.test(page[0]),
      'CSS caps AND centres .settings-page', page && page[0].trim())
  }

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
