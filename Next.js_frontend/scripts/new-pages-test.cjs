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
const ACCOUNTS = [
  ['pt-23@adglobex.test', 'pt-23'],
  ['pt-2j@adglobex.test', 'pt-2j'],
  ['pt-24@adglobex.test', 'pt-24'],
  ['pt-24ak@adglobex.test', 'pt-24ak'],
]
const lastSegment = (label) => String(label).split('/').pop().trim().toLowerCase()

let failures = 0
const check = (ok, label, detail = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  // Unauthenticated
  const payNo = await fetch(`${BASE}/api/p/payments`)
  check(payNo.status === 401, 'payments without session returns 401', `status=${payNo.status}`)

  for (const [email, tag] of ACCOUNTS) {
    const sb = createClient(SUPA, ANON, { auth: { persistSession: false } })
    const { data } = await sb.auth.signInWithPassword({ email, password: 'Partner!2026' })
    const ref = new URL(SUPA).hostname.split('.')[0]
    const h = { cookie: `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(data.session)).toString('base64')}` }

    console.log(`\n--- ${tag} ---`)

    // Payments API
    const payRes = await fetch(`${BASE}/api/p/payments`, { headers: h })
    const pay = await payRes.json()
    check(payRes.status === 200, 'payments returns 200', `status=${payRes.status}`)
    check(pay.partner?.tag === tag, 'payments reports correct tag', pay.partner?.tag)
    check(Array.isArray(pay.earnings), 'payments has earnings array', `len=${pay.earnings.length}`)
    check(typeof pay.performance?.totalSites === 'number', 'payments has performance.totalSites', pay.performance?.totalSites)
    check(Array.isArray(pay.topSites), 'payments has topSites array', `len=${pay.topSites.length}`)
    // mcm_earnings is empty warehouse-wide, so earnings must be empty — never fabricated.
    check(pay.earnings.length === 0, 'earnings empty (mcm_earnings has 0 rows)', `len=${pay.earnings.length}`)
    // topSites must be partner-scoped.
    const topWrong = pay.topSites.filter((s) => lastSegment(s.label) !== tag)
    check(topWrong.length === 0, 'topSites scoped to tag',
      topWrong.length ? topWrong.slice(0, 2).map((s) => s.label).join(', ') : '')

    // Sites with invitation facet
    const facetRes = await fetch(`${BASE}/api/p/sites?facet=invitation&page_size=200`, { headers: h })
    const facet = await facetRes.json()
    check(facetRes.status === 200, 'sites facet=invitation returns 200', `status=${facetRes.status}`)
    check(facet.facet === 'invitation', 'facet echoed', facet.facet)
    check(typeof facet.counts?.accepted === 'number', 'invitation counts present',
      JSON.stringify(facet.counts))
    // Sum of invitation buckets must equal total (no nulls counted).
    const c = facet.counts
    const bucketSum = (c.accepted ?? 0) + (c.pending ?? 0) + (c.withdrawn ?? 0) + (c.rejected ?? 0)
    check(bucketSum === c.total, 'invitation buckets sum to total',
      `sum=${bucketSum} total=${c.total}`)
    // Isolation still holds under the new facet.
    const facetWrong = facet.results.filter((s) => lastSegment(s.label) !== tag)
    check(facetWrong.length === 0, 'facet results scoped to tag',
      facetWrong.length ? facetWrong.slice(0, 2).map((s) => s.label).join(', ') : '')

    // Filter by invitation status
    const acceptedRes = await fetch(`${BASE}/api/p/sites?facet=invitation&status=ACCEPTED&page_size=200`, { headers: h })
    const accepted = await acceptedRes.json()
    check(acceptedRes.status === 200, 'filter ACCEPTED returns 200', `status=${acceptedRes.status}`)
    check(accepted.count === accepted.results.length, 'filtered count matches results',
      `count=${accepted.count} len=${accepted.results.length}`)
    check(accepted.results.every((s) => s.invitationStatus === 'ACCEPTED'), 'all rows are ACCEPTED')
    check(accepted.count === (c.accepted ?? 0), 'filtered count matches bucket',
      `count=${accepted.count} bucket=${c?.accepted}`)

    // Pages render
    for (const page of ['/p/payments', '/p/publishers', '/p/publishers/new']) {
      const res = await fetch(`${BASE}${page}`, { headers: h })
      const html = await res.text()
      check(res.status === 200, `${page} renders 200`, `status=${res.status} bytes=${html.length}`)
    }
  }

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
