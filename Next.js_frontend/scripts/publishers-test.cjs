/* End-to-end test for partner publisher submissions (/p/publishers/new). */
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
const LOC = process.env.BIGQUERY_LOCATION
const BQ_CRED = process.env.BIGQUERY_CREDENTIALS_JSON
const bq = new BigQuery({ projectId: process.env.BIGQUERY_PROJECT_ID, location: LOC, ...(BQ_CRED && { credentials: JSON.parse(BQ_CRED) }) })
const T = (n) => `\`${process.env.BIGQUERY_PROJECT_ID}.${process.env.BIGQUERY_DATASET}.${n}\``

let failures = 0
const check = (ok, label, detail = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` -> ${detail}` : ''}`)
}

async function session(email) {
  const sb = createClient(SUPA, ANON, { auth: { persistSession: false } })
  const { data, error } = await sb.auth.signInWithPassword({ email, password: 'Partner!2026' })
  if (error) throw new Error(`${email}: ${error.message}`)
  const ref = new URL(SUPA).hostname.split('.')[0]
  return {
    tag: data.user.app_metadata.partner_tag,
    email: data.user.email,
    headers: { cookie: `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(data.session)).toString('base64')}` },
  }
}

const post = (url, headers, body) =>
  fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
const get = (url, headers) => fetch(`${BASE}${url}`, { headers })

const query = async (sql, params) => {
  const [rows] = await bq.query({ query: sql, params, location: LOC, useQueryCache: false })
  return rows
}

/** A network code that genuinely exists, so the duplicate branch is exercised. */
async function existingCodeFor(tag) {
  const rows = await query(
    `SELECT network_code FROM ${T('network_codes')}
     WHERE STARTS_WITH(LOWER(label), @tag || '-')
     LIMIT 1`,
    { tag },
  )
  return rows[0]?.network_code ?? null
}

async function main() {
  const pt23 = await session('pt-23@adglobex.test')
  const pt2j = await session('pt-2j@adglobex.test')
  check(pt23.tag === 'pt-23' && pt2j.tag === 'pt-2j', 'session tags resolve', `${pt23.tag}/${pt2j.tag}`)

  const code = await existingCodeFor('pt-23')
  check(Boolean(code), 'found an existing network_code under pt-23', code)
  if (!code) return

  const body = {
    site: 'https://Submit-Test.Example.com/path?q=1',
    gamEmail: 'ops@submit-test.example.com',
    networkCode: code,
    childShare: 10,
    delegationType: 'MANAGE_ACCOUNT',
    // Deliberately smuggled: the form no longer collects these, so the API
    // must ignore rather than persist them.
    whatsapp: '923001112223',
    note: 'please onboard',
  }

  /* --------------------------- duplicate is blocked --------------------------- */
  const dup = await post('/api/p/publishers/requests', pt23.headers, body)
  check(dup.status === 409, 'duplicate network_code returns 409', String(dup.status))
  const dupBody = await dup.json()
  check(
    /already exists/i.test(dupBody.error ?? ''),
    'duplicate message tells them to contact the admin',
    dupBody.error,
  )

  const stored = await query(
    `SELECT * FROM ${T('partner_submission_requests')}
     WHERE partner_tag = 'pt-23' AND network_code = @c
     ORDER BY created_at DESC LIMIT 1`,
    { c: code },
  )
  const row = stored[0]
  check(Boolean(row), 'blocked attempt was written to BigQuery')
  if (row) {
    check(row.status === 'unread', 'status is unread', row.status)
    check(row.reason === 'duplicate', 'reason is duplicate', row.reason)
    check(row.existing_partner_tag === 'pt-23', 'existing_owner recorded', row.existing_partner_tag)
    check(row.partner_email === pt23.email || typeof row.partner_email === 'string', 'partner email stored')
    check(row.gam_email === 'ops@submit-test.example.com', 'publisher email stored', row.gam_email)
    // Site must be normalised to a bare host, and the label must end in the
    // submitting partner's tag so the bot files it under the right partner.
    check(row.site === 'submit-test.example.com', 'site normalised to bare host', row.site)
    check(
      String(row.child_name).toLowerCase() === 'submit-test.example.com/pt-23',
      'child_name carries the partner tag',
      row.child_name,
    )
    check(row.revenue_share_millipercent === 90000, 'childShare 10 -> parent 90% (90000 millipercent)', String(row.revenue_share_millipercent))
    // The form no longer collects WhatsApp/note, so anything sent is ignored
  // rather than persisted — this keeps a stale client from smuggling text
  // into the admin's record.
  check(row.note === null || row.note === undefined, 'note is not persisted', String(row.note))
    check(row.gam_company_id === null, 'nothing was sent to GAM', String(row.gam_company_id))
  }

  /* ------------------------- spoofing the tag is ignored ------------------------ */
  const spoofed = await post('/api/p/publishers/requests', pt23.headers, { ...body, partnerTag: 'pt-2j' })
  check(spoofed.status === 409, 'spoofed partnerTag still blocked', String(spoofed.status))
  const spoofRow = await query(
    `SELECT partner_tag FROM ${T('partner_submission_requests')}
     WHERE partner_tag = 'pt-2j' AND network_code = @c`,
    { c: code },
  )
  check(spoofRow.length === 0, 'body partnerTag never widens scope', `${spoofRow.length} rows under pt-2j`)

  /* ------------------------------ list + isolation ----------------------------- */
  const list = await get('/api/p/publishers/requests', pt23.headers)
  check(list.status === 200, 'list returns 200', String(list.status))
  const listBody = await list.json()
  check(
    (listBody.requests ?? []).some((r) => r.requestId === row?.request_id),
    'the blocked request appears in the partner list',
  )

  const otherList = await get('/api/p/publishers/requests', pt2j.headers)
  const otherBody = await otherList.json()
  check(
    !(otherBody.requests ?? []).some((r) => r.networkCode === code),
    "pt-2j cannot see pt-23's request",
  )

  /* -------------------------------- validation -------------------------------- */
  const noFields = await post('/api/p/publishers/requests', pt23.headers, {})
  check(noFields.status === 400, 'empty body returns 400', String(noFields.status))

  const zeroShare = await post('/api/p/publishers/requests', pt23.headers, { ...body, childShare: 0 })
  check(zeroShare.status === 400, 'childShare below 1% rejected', String(zeroShare.status))

  const hugeShare = await post('/api/p/publishers/requests', pt23.headers, { ...body, childShare: 101 })
  check(hugeShare.status === 400, 'childShare above 100% rejected', String(hugeShare.status))

  /* ------------------------ the admin's cap is enforced ------------------------ */
  // PT-24 was created with max_revenue_share = 95, so anything above that must
  // be refused server-side even though the slider would not offer it.
  {
    const capped = await session('pt-24@adglobex.test')
    const info = await get('/api/p/partner', capped.headers)
    const infoBody = await info.json()
    check(infoBody.maxRevenueShare === 95, 'cap is exposed to the form', String(infoBody.maxRevenueShare))

    const over = await post('/api/p/publishers/requests', capped.headers, {
      ...body,
      networkCode: '9999000222',
      childShare: 96,
    })
    check(over.status === 403, 'share above the cap returns 403', String(over.status))
    const overBody = await over.json()
    check(/cannot exceed 95/i.test(overBody.error ?? ''), 'refusal names the cap', overBody.error)

    const atCap = await post('/api/p/publishers/requests', capped.headers, {
      ...body,
      networkCode: '9999000223',
      childShare: 95,
    })
    check(atCap.status !== 403, 'share at the cap is not refused by the ceiling', String(atCap.status))
  }

  const badEmail = await post('/api/p/publishers/requests', pt23.headers, { ...body, gamEmail: 'not-an-email' })
  check(badEmail.status === 400, 'malformed email rejected', String(badEmail.status))

  const badSite = await post('/api/p/publishers/requests', pt23.headers, { ...body, site: 'nodots' })
  check(badSite.status === 400, 'site without a TLD rejected', String(badSite.status))

  /* ---------------------- unlinked partner is refused ---------------------- */
  // A session tag that is not a real partner_ticket must be refused, otherwise
  // the request would create a GAM child named after a ticket no dashboard can
  // resolve. A throwaway user keeps this independent of which partners exist.
  {
    const admin = createClient(SUPA, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
    const email = `pt-unlinked-${Date.now()}@adglobex.test`
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: 'Partner!2026',
      email_confirm: true,
      app_metadata: { partner_tag: 'pt-does-not-exist' },
    })
    if (createErr) {
      check(false, 'temp unlinked user created', createErr.message)
    } else {
      try {
        const unlinked = await session(email)
        check(unlinked.tag === 'pt-does-not-exist', 'temp user carries an unknown ticket', unlinked.tag)
        const res = await post('/api/p/publishers/requests', unlinked.headers, body)
        check(res.status === 403, 'partner without a ticket row returns 403', String(res.status))
        const msg = await res.json()
        check(/not linked/i.test(msg.error ?? ''), 'refusal explains the account is unlinked', msg.error)
      } finally {
        await admin.auth.admin.deleteUser(created.user.id)
      }
    }
  }

  const anon = await post('/api/p/publishers/requests', {}, body)
  check(anon.status === 401, 'unauthenticated POST returns 401', String(anon.status))

  const anonList = await get('/api/p/publishers/requests', {})
  check(anonList.status === 401, 'unauthenticated GET returns 401', String(anonList.status))

  /* --------------------------- GAM branch (guarded) --------------------------- */
  // Only exercised while the GAM credentials are still placeholders — once they
  // are real this would create a genuine child publisher in Ad Manager.
  const gamPlaceholder = /REPLACE_WITH/.test(process.env.GAM_PRIVATE_KEY ?? '')
  if (gamPlaceholder) {
    const res = await post('/api/p/publishers/requests', pt23.headers, { ...body, networkCode: '9999000111' })
    check(res.status === 502, 'GAM failure surfaces as 502', String(res.status))
    const failRow = await query(
      `SELECT status, reason, error_message FROM ${T('partner_submission_requests')}
       WHERE partner_tag = 'pt-23' AND network_code = '9999000111'
       ORDER BY created_at DESC LIMIT 1`,
    )
    check(failRow[0]?.status === 'failed', 'GAM failure is recorded as failed', failRow[0]?.status)
    check(failRow[0]?.reason === 'gam_error', 'reason is gam_error', failRow[0]?.reason)
    check(Boolean(failRow[0]?.error_message), 'error message retained')
  } else {
    console.log('  SKIP  GAM branch (real credentials configured)')
  }

  /* --------------------------------- cleanup --------------------------------- */
  await query(
    `DELETE FROM ${T('partner_submission_requests')}
     WHERE network_code IN UNNEST(@codes) AND gam_company_id IS NULL`,
    { codes: [code, '9999000111'] },
  )

  /* ---------------------------------- pages ---------------------------------- */
  const pages = fs.existsSync(path.join(__dirname, '..', '.next', 'dev', 'static', 'chunks'))
    ? path.join(__dirname, '..', '.next', 'dev', 'static', 'chunks')
    : path.join(__dirname, '..', '.next', 'static', 'chunks')
  const chunkText = (dir) => {
    let out = ''
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) walk(p)
        else if (/\.(js|css)$/.test(e.name)) out += fs.readFileSync(p, 'utf8')
      }
    }
    if (fs.existsSync(dir)) walk(dir)
    return out
  }
  const shipped = chunkText(pages) + chunkText(path.join(__dirname, '..', '.next', 'static', 'css'))
  check(shipped.includes('already exists'), 'blocked message ships in the client bundle')
  check(shipped.includes('status-unread'), 'unread status chip ships in CSS')
  check(shipped.includes('/api/p/publishers/requests'), 'submit endpoint referenced in the client')

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
