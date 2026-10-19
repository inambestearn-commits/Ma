/* Verifies the range-driven /api/p/summary. */
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
const DS = `\`${process.env.BIGQUERY_PROJECT_ID}.${process.env.BIGQUERY_DATASET}.adx_daily_stats\``
const TAG = (c, tag) => `STARTS_WITH(LOWER(${c}), '${tag}' || '-')`

let failures = 0
const check = (ok, label, detail = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}
const todayIso = () => new Date().toISOString().slice(0, 10)
const shiftDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
}
const round2 = (n) => Math.round(n * 100) / 100

async function main() {
  const sb = createClient(SUPA, ANON, { auth: { persistSession: false } })
  const { data } = await sb.auth.signInWithPassword({ email: 'pt-23@adglobex.test', password: 'Partner!2026' })
  const ref = new URL(SUPA).hostname.split('.')[0]
  const H = { cookie: `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(data.session)).toString('base64')}` }

  // BigQuery ground truth for pt-23 over an arbitrary window.
  const truth = async (from, to) => {
    const [rows] = await bq.query({
      query: `SELECT COALESCE(SUM(d.revenue),0) AS revenue,
                     COALESCE(SUM(d.impressions),0) AS impressions,
                     COALESCE(SUM(d.clicks),0) AS clicks,
                     COUNT(DISTINCT IF(d.revenue > 0, d.network_code, NULL)) AS earning
              FROM ${DS} d
              JOIN (SELECT network_code FROM ${NC} WHERE ${TAG('label', 'pt-23')}) s USING(network_code)
              WHERE d.date BETWEEN @from AND @to`,
      params: { from, to }, location: process.env.BIGQUERY_LOCATION, useQueryCache: false,
    })
    return rows[0]
  }

  const today = todayIso()

  console.log('=== default (today) ===')
  const t0 = await (await fetch(`${BASE}/api/p/summary`, { headers: H })).json()
  check(t0.range?.from === today && t0.range?.to === today, 'defaults to a single day = today',
    `${t0.range?.from}..${t0.range?.to}`)
  check(t0.range?.isToday === true, 'isToday is true by default')
  const gtToday = await truth(today, today)
  check(round2(t0.performance.revenue) === round2(Number(gtToday.revenue)), 'revenue matches BigQuery',
    `api=${round2(t0.performance.revenue)} bq=${round2(Number(gtToday.revenue))}`)
  check(t0.performance.impressions === Number(gtToday.impressions), 'impressions match BigQuery',
    `api=${t0.performance.impressions} bq=${gtToday.impressions}`)
  check(t0.performance.clicks === Number(gtToday.clicks), 'clicks match BigQuery',
    `api=${t0.performance.clicks} bq=${gtToday.clicks}`)
  check(t0.range.sitesEarning === Number(gtToday.earning), 'sites earning matches BigQuery',
    `api=${t0.range.sitesEarning} bq=${gtToday.earning}`)
  // The split is recomputed from the daily rows rather than read from the
  // bot's once-a-day snapshot, so it answers ANY window. The invariant that
  // matters is that applicable + not-applicable equals the revenue shown
  // beside it — the snapshot could not hold that, because it was written at a
  // different moment from the daily table and drifts whenever rows are
  // restated.
  const splitOk = (label, body) => {
    const s = body.split
    if (!s?.available) {
      check(body.performance.revenue === 0, `${label}: a dash means the window truly has no data`,
        `revenue=${body.performance.revenue}`)
      return
    }
    const sum = s.applicableRevenue + s.notApplicableRevenue
    check(Math.abs(sum - body.performance.revenue) < 0.01,
      `${label}: applicable + not-applicable equals the revenue shown`,
      `split=${sum.toFixed(2)} revenue=${body.performance.revenue.toFixed(2)}`)
  }
  splitOk('default', t0)

  console.log('\n=== explicit single date ===')
  const one = await (await fetch(`${BASE}/api/p/summary?from=${today}&to=${today}`, { headers: H })).json()
  check(one.range.isSingleDay === true, 'isSingleDay true when from === to')
  check(round2(one.performance.revenue) === round2(t0.performance.revenue), 'same figures as the default')

  console.log('\n=== 7-day span ===')
  const f7 = shiftDays(today, -6)
  const t7 = await (await fetch(`${BASE}/api/p/summary?from=${f7}&to=${today}`, { headers: H })).json()
  const gt7 = await truth(f7, today)
  check(t7.range.from === f7 && t7.range.to === today, 'range echoes the requested span',
    `${t7.range.from}..${t7.range.to}`)
  check(t7.range.isSingleDay === false, 'isSingleDay false for a span')
  check(round2(t7.performance.revenue) === round2(Number(gt7.revenue)), 'span revenue matches BigQuery',
    `api=${round2(t7.performance.revenue)} bq=${round2(Number(gt7.revenue))}`)
  check(t7.performance.impressions === Number(gt7.impressions), 'span impressions match BigQuery',
    `api=${t7.performance.impressions} bq=${gt7.impressions}`)
  check(t7.split?.available === true, 'the 7d window yields a real applicable figure')
  check(t7.split?.applicableRevenue > 0, 'the 7d applicable figure is a real sum',
    t7.split?.applicableRevenue)
  check(typeof t7.split?.iosImpressionSharePct === 'number',
    'iOS impression share is numeric for a span', t7.split?.iosImpressionSharePct)
  splitOk('7d span', t7)

  // The old snapshot logic refused any window that was neither the snapshot
  // day nor a full data span, so "7 days" and most partial windows showed a
  // dash. Recomputing from the daily rows removes that entire class of
  // refusal — probe a spread of windows and require the invariant on each.
  console.log('\n=== the split answers every window ===')
  for (let back = 1; back <= 10; back++) {
    const f = shiftDays(today, -back)
    const b = await (await fetch(`${BASE}/api/p/summary?from=${f}&to=${today}`, { headers: H })).json()
    splitOk(`${back + 1}d window`, b)
  }
  // A window that stops short of the most recent day is the shape the old
  // logic refused outright.
  const short = await (await fetch(
    `${BASE}/api/p/summary?from=${shiftDays(today, -2)}&to=${shiftDays(today, -1)}`, { headers: H })).json()
  splitOk('a window that stops short of today', short)

  // A window with no rows at all must show a dash rather than zeros, so a
  // partner cannot mistake "nothing measured here" for "the split is zero".
  const empty = await (await fetch(
    `${BASE}/api/p/summary?from=2020-01-01&to=2020-01-07`, { headers: H })).json()
  check(empty.split?.available === false, 'a window with no data shows a dash, not zeros',
    `revenue=${empty.performance.revenue} available=${empty.split?.available}`)

  console.log('\n=== 30-day span ===')
  const f30 = shiftDays(today, -29)
  const t30 = await (await fetch(`${BASE}/api/p/summary?from=${f30}&to=${today}`, { headers: H })).json()
  const gt30 = await truth(f30, today)
  check(round2(t30.performance.revenue) === round2(Number(gt30.revenue)), '30d revenue matches BigQuery',
    `api=${round2(t30.performance.revenue)} bq=${round2(Number(gt30.revenue))}`)

  console.log('\n=== clamping / hardening ===')
  const swapped = await (await fetch(`${BASE}/api/p/summary?from=${today}&to=${f7}`, { headers: H })).json()
  check(swapped.range.from === f7 && swapped.range.to === today, 'from > to is swapped, not rejected',
    `${swapped.range.from}..${swapped.range.to}`)
  const future = await (await fetch(`${BASE}/api/p/summary?from=${shiftDays(today, 5)}&to=${shiftDays(today, 9)}`, { headers: H })).json()
  check(future.range.from === today && future.range.to === today, 'future range clamps to today',
    `${future.range.from}..${future.range.to}`)
  const junk = await (await fetch(`${BASE}/api/p/summary?from=banana&to=2026-99-99`, { headers: H })).json()
  check(junk.range.from === today && junk.range.to === today, 'invalid input falls back to today',
    `${junk.range.from}..${junk.range.to}`)

  console.log('\n=== top sites follows the range ===')
  // BigQuery ground truth for the best sites in a window.
  const truthTop = async (from, to) => {
    const [rows] = await bq.query({
      query: `SELECT d.network_code, SUM(d.revenue) AS revenue
              FROM ${DS} d
              JOIN (SELECT network_code FROM ${NC} WHERE ${TAG('label', 'pt-23')}) s USING(network_code)
              WHERE d.date BETWEEN @from AND @to
              GROUP BY 1 HAVING revenue > 0 ORDER BY revenue DESC LIMIT 8`,
      params: { from, to }, location: process.env.BIGQUERY_LOCATION, useQueryCache: false,
    })
    return rows.map((r) => String(r.network_code)).sort().join(',')
  }
  const gtTop7 = await truthTop(f7, today)
  const apiTop7 = t7.topSites.map((s) => s.networkCode).sort().join(',')
  check(apiTop7 === gtTop7, '7d top sites match BigQuery',
    `api=${t7.topSites.length} sites, bq=${gtTop7 ? gtTop7.split(',').length : 0}`)
  check(t7.topSites.length > 0, '7d span returns sites (range includes the synced day)',
    `${t7.topSites.length} sites, revenue=${round2(t7.topSites.reduce((a, s) => a + s.revenue, 0))}`)
  const gtTop30 = await truthTop(f30, today)
  check(t30.topSites.map((s) => s.networkCode).sort().join(',') === gtTop30,
    '30d top sites match BigQuery')

  console.log('\n=== trend respects the range ===')
  check(t7.trend.points.length <= 7, '7d span returns at most 7 daily points',
    `${t7.trend.points.length} points`)
  check(t7.trend.points.every((p) => p.date >= f7 && p.date <= today), 'every point falls inside the span')
  check(t30.trend.points.every((p) => p.date >= f30 && p.date <= today), 'every 30d point falls inside the span')

  console.log('\n=== SPLIT panel labels in the shipped bundle ===')
  // The page is client-rendered, so assert on what is actually served to the
  // browser rather than on SSR HTML. Prefer the dev build (that is what the
  // running server serves) and fall back to a production build.
  const devChunks = path.join(__dirname, '..', '.next', 'dev', 'static', 'chunks')
  const prodChunks = path.join(__dirname, '..', '.next', 'static', 'chunks')
  const chunkDir = fs.existsSync(devChunks) ? devChunks : prodChunks
  const files = fs.existsSync(chunkDir)
    ? fs.readdirSync(chunkDir).filter((f) => f.endsWith('.js'))
    : []
  check(files.length > 0, 'found client chunks to inspect', `${files.length} files`)
  const bundle = files
    .map((f) => { try { return fs.readFileSync(path.join(chunkDir, f), 'utf8') } catch { return '' } })
    .join('\n')
  check(!bundle.includes('iOS impressions'),
    'home page no longer shows the iOS impressions metric')
  check(!bundle.includes('Revenue breakdown'),
    'home page no longer shows the revenue breakdown panel')
  check(!bundle.includes('of applicable revenue'),
    'home page no longer claims the iOS figure is a share of applicable revenue')
  check(!bundle.includes('written once a day'),
    'the applicable-split explainer footnote is gone from the page')
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
