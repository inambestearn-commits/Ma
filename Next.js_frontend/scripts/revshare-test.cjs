/* Verifies /api/p/sites revenueSharePct against BigQuery ground truth. */
const { createClient } = require('@supabase/supabase-js')
const { BigQuery } = require('@google-cloud/bigquery')
const fs = require('fs')
const path = require('path')

for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const BASE = 'http://localhost:3000'
const BQ_CRED = process.env.BIGQUERY_CREDENTIALS_JSON
const bq = new BigQuery({ projectId: process.env.BIGQUERY_PROJECT_ID, location: process.env.BIGQUERY_LOCATION, ...(BQ_CRED && { credentials: JSON.parse(BQ_CRED) }) })
const NC = `\`${process.env.BIGQUERY_PROJECT_ID}.${process.env.BIGQUERY_DATASET}.network_codes\``
const TAG = (c) => `STARTS_WITH(LOWER(${c}), @tag || '-')`

const ACCOUNTS = [
  ['pt-23@adglobex.test', 'pt-23', 'account'],
  ['pt-23@adglobex.test', 'pt-23', 'invitation'],
  ['pt-2j@adglobex.test', 'pt-2j', 'account'],
  ['pt-24@adglobex.test', 'pt-24', 'account'],
  ['pt-24ak@adglobex.test', 'pt-24ak', 'account'],
]

let failures = 0
const check = (ok, label, detail = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

async function groundTruth(tag) {
  const [rows] = await bq.query({
    query: `SELECT network_code, revenue_share_millipercent AS raw
            FROM ${NC} WHERE ${TAG('label')}`,
    params: { tag },
    location: process.env.BIGQUERY_LOCATION,
    useQueryCache: false,
  })
  const map = new Map()
  for (const r of rows) map.set(String(r.network_code), r.raw === null ? null : Number(r.raw))
  return map
}

async function main() {
  for (const [email, tag, facet] of ACCOUNTS) {
    const gt = await groundTruth(tag)
    const sb = createClient(SUPA, ANON, { auth: { persistSession: false } })
    const { data } = await sb.auth.signInWithPassword({ email, password: 'Partner!2026' })
    const ref = new URL(SUPA).hostname.split('.')[0]
    const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(data.session)).toString('base64')}`

    // Fetch enough pages to cover every site for this tag.
    const all = []
    let page = 1
    for (;;) {
      const r = await fetch(`${BASE}/api/p/sites?facet=${facet}&page=${page}&page_size=200`, { headers: { cookie } })
      if (!r.ok) { check(false, `${tag}/${facet} API ${r.status}`); break }
      const j = await r.json()
      all.push(...j.results)
      if (all.length >= j.count) break
      if (++page > 20) break
    }

    check(all.length === gt.size, `${tag}/${facet} row count matches BQ`,
      `api=${all.length} bq=${gt.size}`)

    const mismatches = []
    let checked = 0
    for (const s of all) {
      const raw = gt.get(s.networkCode)
      if (raw === undefined) continue
      checked++
      const expected = raw === null ? null : Math.round((raw / 1000) * 10) / 10
      if (s.revenueSharePct !== expected) {
        mismatches.push(`${s.networkCode} raw=${raw} api=${s.revenueSharePct} expected=${expected}`)
      }
    }
    check(mismatches.length === 0, `${tag}/${facet} every revenueSharePct correct`,
      mismatches.slice(0, 5).join('; ') || `checked ${checked}`)

    // Sanity: values must be in a plausible percentage range, not 10x too small.
    const nums = all.map((s) => s.revenueSharePct).filter((v) => v !== null)
    const badRange = nums.filter((v) => v < 1 || v > 100)
    check(badRange.length === 0, `${tag}/${facet} all shares in 1–100% range`,
      nums.length ? `min=${Math.min(...nums)} max=${Math.max(...nums)}` : 'no values')

    // Every non-null share should look like a whole-ish percent (data is multiples of 1000).
    const nonInteger = nums.filter((v) => !Number.isInteger(v))
    check(nonInteger.length === 0, `${tag}/${facet} shares are whole percents`,
      nonInteger.length ? `e.g. ${nonInteger.slice(0, 3).join(', ')}` : 'all integers')
  }

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
