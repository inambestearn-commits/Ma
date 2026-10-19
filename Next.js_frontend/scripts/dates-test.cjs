/* Verifies the summary/reporting APIs return real ISO dates, not "[object Object]". */
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

const looksIso = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)
const hasObjectObject = (v) => JSON.stringify(v).includes('[object Object]')

async function main() {
  const sb = createClient(SUPA, ANON, { auth: { persistSession: false } })
  const { data } = await sb.auth.signInWithPassword({ email: 'pt-23@adglobex.test', password: 'Partner!2026' })
  const ref = new URL(SUPA).hostname.split('.')[0]
  const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(data.session)).toString('base64')}`
  const H = { cookie }

  console.log('=== /api/p/summary ===')
  // Query with an explicit window rather than the default (today): the bot may
  // not have written today's rows yet, and the date parsing under test is the
  // same either way.
  const today = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10)
  const sum = await (await fetch(`${BASE}/api/p/summary?from=${from}&to=${today}`, { headers: H })).json()
  check(!hasObjectObject(sum), 'no "[object Object]" anywhere in the payload')
  check(looksIso(sum.meta.lastSyncedAt), 'meta.lastSyncedAt is a real ISO timestamp',
    sum.meta.lastSyncedAt)
  check(looksIso(sum.range?.from) && looksIso(sum.range?.to), 'range.from/to are real ISO dates',
    `${sum.range?.from}..${sum.range?.to}`)
  check(sum.trend.points.length > 0, 'trend has points over a 30d window',
    `${sum.trend.points.length}`)
  check(sum.trend.points.every((p) => looksIso(p.date)), 'every trend point has a real date',
    JSON.stringify(sum.trend.points.map((p) => p.date)))
  check(sum.trend.points.every((p) => typeof p.impressions === 'number'),
    'trend points carry impressions', JSON.stringify(sum.trend.points[0]))

  console.log('\n=== /api/p/reporting ===')
  const rep = await (await fetch(`${BASE}/api/p/reporting?dimension=overview`, { headers: H })).json()
  check(!hasObjectObject(rep), 'no "[object Object]" anywhere in the payload')
  check(looksIso(rep.meta.lastSyncedAt), 'meta.lastSyncedAt is a real ISO timestamp',
    rep.meta.lastSyncedAt)
  check(looksIso(rep.meta.firstDataDate), 'meta.firstDataDate is a real ISO date',
    rep.meta.firstDataDate)
  check(looksIso(rep.meta.lastDataDate), 'meta.lastDataDate is a real ISO date',
    rep.meta.lastDataDate)
  check(rep.dates.every(looksIso), 'every entry in dates[] is a real date',
    JSON.stringify(rep.dates))

  console.log('\n=== /api/p/payments ===')
  const pay = await (await fetch(`${BASE}/api/p/payments`, { headers: H })).json()
  check(!hasObjectObject(pay), 'no "[object Object]" anywhere in the payload')
  check(looksIso(pay.meta.lastSyncedAt), 'meta.lastSyncedAt is a real ISO timestamp',
    pay.meta.lastSyncedAt)
  check(looksIso(pay.meta.firstDataDate), 'meta.firstDataDate is a real ISO date',
    pay.meta.firstDataDate)

  console.log('\n=== /p shell renders ===')
  // /p is a client component: SSR emits the shell and the panel hydrates in the
  // browser, so the new markup is asserted against the shipped client bundle
  // rather than the SSR HTML.
  const page = await fetch(`${BASE}/p`, { headers: H })
  check(page.status === 200, '/p returns 200', `status=${page.status}`)
  const html = await page.text()
  const text = html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  check(!text.includes('[object Object]'), 'no "[object Object]" in rendered HTML')
  check(!/Synced \[object Object\]/.test(text), 'Synced line is not "[object Object]"')

  console.log('\n=== new panel shipped to the client bundle ===')
  const bundleDir = path.join(__dirname, '..', '.next', 'static')
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(js|css)$/.test(e.name) ? [path.join(dir, e.name)] : [],
    )
  const bundle = fs.existsSync(bundleDir)
    ? walk(bundleDir).map((f) => fs.readFileSync(f, 'utf8')).join('')
    : ''
  check(bundle.length > 0, 'client bundle found', `${bundle.length} bytes`)
  for (const needle of [
    'trend-figures',
    'trend-bar-secondary',
    'Days in range',
    'legend-dot',
    'range-picker',
    'range-preset',
    'range-sep',
  ]) {
    check(bundle.includes(needle), `bundle contains "${needle}"`)
  }
  // Two date inputs (From / To) plus the presets: the span control the user
  // asked for. Both must be real <input type="date"> calendar widgets.
  check((bundle.match(/type:\s*"date"|type="date"/g) || []).length >= 2,
    'bundle renders two <input type="date"> controls (From / To)')
  for (const preset of ['Today', '7 days', '30 days']) {
    check(bundle.includes(preset), `bundle contains the "${preset}" preset`)
  }

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
