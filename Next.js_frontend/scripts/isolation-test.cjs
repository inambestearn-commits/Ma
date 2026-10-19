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

// The tags that must never bleed into each other.
const ALL_TAGS = ACCOUNTS.map(([, t]) => t)

const lastSegment = (label) => {
  const parts = String(label).split('/')
  return parts[parts.length - 1].trim().toLowerCase()
}

let failures = 0
const check = (ok, label, detail = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  console.log('=== 1. UNAUTHENTICATED ACCESS ===')
  const rNoAuth = await fetch(`${BASE}/p`, { redirect: 'manual' })
  check(rNoAuth.status === 307 || rNoAuth.status === 308 || rNoAuth.status === 307,
    'GET /p without session redirects', `status=${rNoAuth.status} location=${rNoAuth.headers.get('location')}`)

  const apiNoAuth = await fetch(`${BASE}/api/p/summary`)
  const apiBody = await apiNoAuth.json().catch(() => null)
  check(apiNoAuth.status === 401, 'GET /api/p/summary without session returns 401',
    `status=${apiNoAuth.status} body=${JSON.stringify(apiBody)}`)

  const sitesNoAuth = await fetch(`${BASE}/api/p/sites`)
  check(sitesNoAuth.status === 401, 'GET /api/p/sites without session returns 401',
    `status=${sitesNoAuth.status}`)

  console.log('\n=== 2. PER-PARTNER ISOLATION ===')
  const seen = {}

  for (const [email, expectedTag] of ACCOUNTS) {
    const sb = createClient(SUPA, ANON, { auth: { persistSession: false } })
    const { data, error } = await sb.auth.signInWithPassword({ email, password: 'Partner!2026' })
    if (error) { check(false, `${expectedTag} signs in`, error.message); continue }

    const ref = new URL(SUPA).hostname.split('.')[0]
    const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(data.session)).toString('base64')}`
    const h = { cookie }

    const [sumRes, sitesRes, repRes] = await Promise.all([
      fetch(`${BASE}/api/p/summary`, { headers: h }),
      fetch(`${BASE}/api/p/sites?page_size=200`, { headers: h }),
      fetch(`${BASE}/api/p/reporting`, { headers: h }),
    ])

    const sum = await sumRes.json()
    const sites = await sitesRes.json()
    const rep = await repRes.json()

    console.log(`\n--- ${expectedTag} ---`)
    check(sumRes.status === 200, 'summary returns 200', `status=${sumRes.status}`)
    check(sitesRes.status === 200, 'sites returns 200', `status=${sitesRes.status}`)
    check(repRes.status === 200, 'reporting returns 200', `status=${repRes.status}`)
    check(sum.partner?.tag === expectedTag, 'summary reports correct tag',
      `got=${sum.partner?.tag}`)

    // THE core assertion: every returned site must carry this partner's tag.
    const results = sites.results || []
    const wrongTag = results.filter((s) => lastSegment(s.label) !== expectedTag)
    check(wrongTag.length === 0,
      `all ${results.length} sites belong to ${expectedTag}`,
      wrongTag.length ? `leaked: ${wrongTag.slice(0, 3).map((s) => s.label).join(', ')}` : '')

    // No site from a colliding partner may appear.
    const colliding = results.filter((s) => {
      const seg = lastSegment(s.label)
      return ALL_TAGS.some((t) => t !== expectedTag && seg === t)
    })
    check(colliding.length === 0, 'no site from another test partner leaked',
      colliding.length ? colliding.slice(0, 3).map((s) => s.label).join(', ') : '')

    // Reporting must be scoped to the same tag.
    const repDomains = (rep.sites || []).map((s) => s.label)
    const repWrong = repDomains.filter((l) => lastSegment(l) !== expectedTag)
    check(repWrong.length === 0, `reporting scoped to ${expectedTag}`,
      repWrong.length ? `leaked: ${repWrong.slice(0, 3).join(', ')}` : '')

    // Counts must agree between the un-joined site count and the list length.
    check(sum.sites.total === sites.count,
      'summary total matches sites count',
      `summary=${sum.sites.total} sites.count=${sites.count}`)

    // Trend must be flagged as having no history (single day of data).
    check(sum.trend.hasHistory === false, 'trend correctly reports no history',
      `hasHistory=${sum.trend.hasHistory} points=${sum.trend.points?.length}`)

    seen[expectedTag] = new Set(results.map((s) => s.networkCode))
  }

  console.log('\n=== 3. PAIRWISE DISJOINTNESS ===')
  const tags = Object.keys(seen)
  for (let i = 0; i < tags.length; i++) {
    for (let j = i + 1; j < tags.length; j++) {
      const a = tags[i], b = tags[j]
      const overlap = [...seen[a]].filter((c) => seen[b].has(c))
      check(overlap.length === 0, `${a} and ${b} share no network codes`,
        overlap.length ? `${overlap.length} shared` : '')
    }
  }

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
