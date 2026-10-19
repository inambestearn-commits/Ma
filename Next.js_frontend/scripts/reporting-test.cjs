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
  for (const [email, tag] of ACCOUNTS) {
    const sb = createClient(SUPA, ANON, { auth: { persistSession: false } })
    const { data } = await sb.auth.signInWithPassword({ email, password: 'Partner!2026' })
    const ref = new URL(SUPA).hostname.split('.')[0]
    const h = { cookie: `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(data.session)).toString('base64')}` }

    console.log(`\n--- ${tag} ---`)

    for (const dim of ['overview', 'site', 'traffic_source', 'device', 'country', 'carrier', 'browser', 'country_carrier']) {
      const res = await fetch(`${BASE}/api/p/reporting?dimension=${dim}&page=1&page_size=8`, { headers: h })
      const body = await res.json()
      check(res.status === 200, `${dim} returns 200`, `status=${res.status} ${res.status !== 200 ? JSON.stringify(body) : ''}`)
      if (res.status !== 200) continue

      check(body.dimension === dim, `${dim} echoes dimension`, body.dimension)
      check(typeof body.count === 'number', `${dim} has count`, `count=${body.count}`)
      check(Array.isArray(body.results), `${dim} has results`, `len=${body.results.length}`)
      check(typeof body.totals.totalSites === 'number', `${dim} has totals.totalSites`, body.totals.totalSites)

      // React keys must be unique per row. A `??` fallback chain stops at the
      // first defined field, and on country_carrier `carrier` is defined before
      // `country` — the warehouse uses "(none)" as the carrier for Wi-Fi traffic
      // across 233 countries, so every such row collapsed onto one key.
      const keys = body.results.map((r) =>
        [r.network_code, r.traffic_source, r.device, r.browser, r.country, r.carrier]
          .filter((v) => v !== undefined && v !== null && v !== '')
          .join(' | ') || 'total',
      )
      const dupes = keys.filter((k, i) => keys.indexOf(k) !== i)
      check(dupes.length === 0, `${dim} row keys are unique`,
        dupes.length ? `${dupes.length} duplicate(s): ${[...new Set(dupes)].slice(0, 3).join(', ')}` : `${keys.length} rows`)

      // Isolation: any site-bearing dimension must show only this tag.
      if (dim === 'site') {
        const wrong = body.results.filter((r) => lastSegment(r.label) !== tag)
        check(wrong.length === 0, `site rows all belong to ${tag}`,
          wrong.length ? wrong.slice(0, 2).map((r) => r.label).join(', ') : '')
      }
    }

    // Targeted guard for the collision that shipped: the Wi-Fi carrier "(none)"
    // spans 233 countries, so country_carrier must key on country AND carrier.
    const cc = await (await fetch(`${BASE}/api/p/reporting?dimension=country_carrier&page=1&page_size=50`, { headers: h })).json()
    const noneRows = cc.results.filter((r) => r.carrier === '(none)')
    if (noneRows.length > 1) {
      const ccKeys = noneRows.map((r) => `${r.country} | ${r.carrier}`)
      check(new Set(ccKeys).size === ccKeys.length,
        'country_carrier "(none)" rows key on country too',
        `${noneRows.length} rows sharing carrier (none)`)
    } else {
      check(true, 'country_carrier "(none)" rows key on country too',
        `only ${noneRows.length} (none) row on this page — collision not reachable here`)
    }

    // Pagination: page 2 of site dimension must differ from page 1.
    const p1 = await (await fetch(`${BASE}/api/p/reporting?dimension=site&page=1&page_size=8`, { headers: h })).json()
    const p2 = await (await fetch(`${BASE}/api/p/reporting?dimension=site&page=2&page_size=8`, { headers: h })).json()
    const codes1 = new Set(p1.results.map((r) => r.network_code))
    const overlap = p2.results.filter((r) => codes1.has(r.network_code))
    check(p2.page === 2 && p1.count === p2.count, 'pagination keeps stable count', `p1=${p1.count} p2=${p2.count}`)
    check(overlap.length === 0, 'page 2 does not repeat page 1 rows',
      overlap.length ? `${overlap.length} repeated` : '')

    // The dimension echo is what lets the UI detect a held-over placeholder.
    check(p1.dimension === 'site', 'response echoes the dimension it was built for', p1.dimension)

    // ---- Date range ------------------------------------------------------
    // Every fact table is partitioned by `date`, so all dimensions honour the
    // window. normalizeRange clamps and swaps rather than erroring.
    const ov = async (q) => {
      const sp = new URLSearchParams({ dimension: 'overview', page: '1', page_size: '8', ...q })
      const res = await fetch(`${BASE}/api/p/reporting?${sp}`, { headers: h })
      return { status: res.status, body: await res.json() }
    }
    const today = new Date().toISOString().slice(0, 10)

    const def = await ov({})
    check(def.status === 200 && typeof def.body.range?.from === 'string',
      'default request resolves a range', JSON.stringify(def.body.range))

    const one = await ov({ from: today, to: today })
    check(one.body.range.from === today && one.body.range.to === today && one.body.range.isToday === true,
      'a today window is flagged isToday', JSON.stringify(one.body.range))

    const week = await ov({ from: new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10), to: today })
    check(week.body.range.isToday === false, 'a wider window is not isToday', JSON.stringify(week.body.range))
    check(week.body.totals.revenue >= one.body.totals.revenue,
      'a wider window is never smaller than a narrower one inside it',
      `week=${week.body.totals.revenue} today=${one.body.totals.revenue}`)

    // Both the iOS share and the applicable split are recomputed from the
    // daily/os rows, so both follow the window. The invariant that matters for
    // the split is that applicable + not-applicable equals the revenue shown
    // beside it — the bot's snapshot could not hold that, because it was
    // written at a different moment from the daily table and drifts whenever
    // rows are restated.
    check(typeof one.body.totals.iosSharePct === 'number' && typeof one.body.totals.iosShareAvailable === 'boolean',
      'iOS share is numeric with an availability flag',
      `pct=${one.body.totals.iosSharePct} avail=${one.body.totals.iosShareAvailable}`)

    const splitOk = (label, res) => {
      const t = res.body.totals
      if (!t.applicableAvailable) {
        check(t.revenue === 0, `${label}: a dash means the window truly has no data`, `revenue=${t.revenue}`)
        return
      }
      const sum = t.applicableRevenue + t.notApplicableRevenue
      check(Math.abs(sum - t.revenue) < 0.01,
        `${label}: applicable + not-applicable equals the revenue shown`,
        `split=${sum.toFixed(2)} revenue=${t.revenue.toFixed(2)}`)
    }
    splitOk('today', one)
    splitOk('7d span', week)
    for (let back = 1; back <= 5; back++) {
      const f = new Date(Date.now() - back * 864e5).toISOString().slice(0, 10)
      splitOk(`${back + 1}d window`, await ov({ from: f, to: today }))
    }

    // Two different windows must produce two different shares; a snapshot
    // column could not, and that is the whole point of deriving it.
    const dayOnly = await ov({ from: week.body.range.to, to: week.body.range.to })
    check(
      !dayOnly.body.totals.iosShareAvailable || !week.body.totals.iosShareAvailable ||
        dayOnly.body.totals.iosSharePct !== week.body.totals.iosSharePct ||
        week.body.range.from === week.body.range.to,
      'iOS share varies between a single day and a wider window',
      `day=${dayOnly.body.totals.iosSharePct} week=${week.body.totals.iosSharePct}`,
    )

    const junk = await ov({ from: 'not-a-date', to: today })
    check(/^\d{4}-\d{2}-\d{2}$/.test(junk.body.range.from), 'junk from degrades to a valid date',
      junk.body.range.from)

    const swapped = await ov({ from: today, to: new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10) })
    check(swapped.body.range.from <= swapped.body.range.to, 'a reversed range is swapped',
      `${swapped.body.range.from}..${swapped.body.range.to}`)

    const future = await ov({ from: '2099-01-01', to: '2099-12-31' })
    check(future.body.range.to <= today, 'a future range clamps to today', future.body.range.to)

    // The window must actually reach the fact tables, not just echo back.
    const siteToday = await (await fetch(`${BASE}/api/p/reporting?dimension=site&from=${today}&to=${today}&page=1&page_size=8`, { headers: h })).json()
    const siteWeek = await (await fetch(`${BASE}/api/p/reporting?dimension=site&from=${new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10)}&to=${today}&page=1&page_size=8`, { headers: h })).json()
    check(siteWeek.count >= siteToday.count, 'site inventory never shrinks as the window widens',
      `week=${siteWeek.count} today=${siteToday.count}`)
  }

  console.log('\n--- UI regressions ---')
  // placeholderData keeps the previous dimension's rows on screen while the next
  // one loads, so the table must blank on a dimension mismatch. The old copy also
  // rendered a "Single-day snapshot" note that has since been removed.
  const chunkDir = path.join(__dirname, '..', '.next', 'dev', 'static', 'chunks')
  const chunks = fs.existsSync(chunkDir)
    ? fs.readdirSync(chunkDir, { recursive: true })
        .filter((f) => typeof f === 'string' && f.endsWith('.js'))
        .map((f) => fs.readFileSync(path.join(chunkDir, f), 'utf8'))
    : []
  const all = chunks.join('\n')
  check(chunks.length > 0, 'found client chunks to inspect', `${chunks.length} files`)
  check(/staleDimension/.test(all), 'table guards against a held-over dimension')
  check(/\.dimension !== dimension/.test(all), 'guard compares the echoed dimension to the selected one')
  check(!/Single-day snapshot/.test(all), 'single-day snapshot notice removed from the bundle')
  check(!/Awaiting data/.test(all), '"Awaiting data" date label removed from the bundle')
  check(/range-picker/.test(all), 'reporting page ships the same range picker as the home page')
  check(/range-preset/.test(all), 'range picker ships Today / 7 days / 30 days presets')
  check(/Single-day only/.test(all), 'snapshot-only metrics say so instead of printing a stale figure')

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
