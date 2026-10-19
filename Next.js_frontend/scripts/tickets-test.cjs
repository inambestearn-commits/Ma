/* End-to-end test for the partner support-ticket system. */
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
const T = (n) => `\`${process.env.BIGQUERY_PROJECT_ID}.${process.env.BIGQUERY_DATASET}.${n}\``

let failures = 0
const check = (ok, label, detail = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

async function session(email) {
  const sb = createClient(SUPA, ANON, { auth: { persistSession: false } })
  const { data, error } = await sb.auth.signInWithPassword({ email, password: 'Partner!2026' })
  if (error) throw new Error(`${email}: ${error.message}`)
  const ref = new URL(SUPA).hostname.split('.')[0]
  return {
    tag: data.user.app_metadata.partner_tag,
    headers: { cookie: `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(data.session)).toString('base64')}` },
  }
}

const post = (url, headers, body) =>
  fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })

// Removes tickets left by a previous run so counts and message totals are predictable.
async function wipeTestTickets() {
  const subjects = [
    'Revenue missing for 8 Oct',
    'Question about revenue share',
    'Spoof attempt',
  ]
  const [rows] = await bq.query({
    query: `SELECT ticket_id FROM ${T('support_tickets')}
            WHERE partner_tag IN ('pt-23', 'pt-24') AND subject IN UNNEST(@subjects)`,
    params: { subjects }, location: process.env.BIGQUERY_LOCATION, useQueryCache: false,
  })
  if (rows.length === 0) return
  const ids = rows.map((r) => r.ticket_id)
  for (const table of ['support_tickets', 'support_ticket_messages', 'support_ticket_history']) {
    await bq.query({
      query: `DELETE FROM ${T(table)} WHERE ticket_id IN UNNEST(@ids)`,
      params: { ids }, location: process.env.BIGQUERY_LOCATION, useQueryCache: false,
    })
  }
  console.log(`(wiped ${ids.length} ticket(s) left by a previous run)\n`)
}

async function main() {
  await wipeTestTickets()

  const a = await session('pt-23@adglobex.test') // partner A
  const b = await session('pt-24@adglobex.test') // partner B

  console.log('=== 1. AUTH GATE ===')
  const anon = await fetch(`${BASE}/api/p/tickets`)
  check(anon.status === 401, 'unauthenticated list is 401', `status=${anon.status}`)
  const anonPost = await post('/api/p/tickets', {}, { subject: 'x', description: 'y', category: 'OTHER' })
  check(anonPost.status === 401, 'unauthenticated create is 401', `status=${anonPost.status}`)

  console.log('\n=== 2. CREATE ===')
  const created = await post('/api/p/tickets', a.headers, {
    subject: 'Revenue missing for 8 Oct',
    description: 'Network code 23360179112 shows no revenue for 2026-10-08.',
    category: 'BILLING',
    priority: 'HIGH',
  })
  check(created.status === 201, 'create returns 201', `status=${created.status}`)
  const { ticketId } = await created.json()
  check(/^TCK-[0-9A-F]{10}$/.test(ticketId), 'ticket id has the expected shape', ticketId)

  // A second ticket so list/pagination has something to count.
  await post('/api/p/tickets', a.headers, {
    subject: 'Question about revenue share',
    description: 'Why does site 23361354223 show a 3% share?',
    category: 'TECHNICAL',
    priority: 'NORMAL',
  })

  console.log('\n=== 3. VALIDATION ===')
  const empty = await post('/api/p/tickets', a.headers, { subject: '', description: '', category: 'NOPE' })
  check(empty.status === 400, 'empty subject/description and bad category is 400', `status=${empty.status}`)
  const emptyBody = await empty.json()
  check(Boolean(emptyBody.fields?.subject), 'response flags the subject field', JSON.stringify(emptyBody.fields))
  check(Boolean(emptyBody.fields?.category), 'response flags the category field')

  // The tag must come from the session, never the body.
  const spoof = await post('/api/p/tickets', a.headers, {
    subject: 'Spoof attempt',
    description: 'Trying to file against another partner.',
    category: 'OTHER',
    priority: 'NORMAL',
    partnerTag: b.tag,
    partner_tag: b.tag,
  })
  check(spoof.status === 201, 'create succeeds but ignores the body tag', `status=${spoof.status}`)
  const spoofId = (await spoof.json()).ticketId

  console.log('\n=== 4. LIST (scoped) ===')
  const listA = await (await fetch(`${BASE}/api/p/tickets`, { headers: a.headers })).json()
  check(listA.results.length >= 3, 'partner A sees their own tickets', `${listA.results.length} tickets`)
  check(listA.results.every((t) => t.ticketId !== undefined), 'rows carry ticket ids')
  check(listA.counts.total >= 3, 'counts.total reflects A tickets', `${listA.counts.total}`)
  check(listA.meta.partnerTag === a.tag, 'response echoes the session tag', listA.meta.partnerTag)

  const listB = await (await fetch(`${BASE}/api/p/tickets`, { headers: b.headers })).json()
  check(listB.results.every((t) => t.ticketId !== ticketId && t.ticketId !== spoofId),
    'partner B cannot see A tickets', `${listB.counts.total} tickets`)
  check(listB.meta.partnerTag === b.tag, 'B response echoes B tag', listB.meta.partnerTag)

  const filtered = await (await fetch(`${BASE}/api/p/tickets?status=BILLING`, { headers: a.headers })).json()
  check(Array.isArray(filtered.results), 'status filter accepts an arbitrary value without error')
  const byCategory = await (await fetch(`${BASE}/api/p/tickets?category=BILLING`, { headers: a.headers })).json()
  check(byCategory.results.length >= 1, 'category filter narrows the list', `${byCategory.results.length}`)
  check(byCategory.results.every((t) => t.category === 'BILLING'), 'only BILLING rows returned')
  const searched = await (await fetch(`${BASE}/api/p/tickets?search=Revenue%20missing`, { headers: a.headers })).json()
  check(searched.results.length >= 1, 'search by subject finds the ticket', `${searched.results.length}`)

  console.log('\n=== 5. DETAIL ===')
  const detail = await (await fetch(`${BASE}/api/p/tickets/${ticketId}`, { headers: a.headers })).json()
  check(detail.ticket?.ticketId === ticketId, 'detail returns the ticket')
  check(detail.ticket?.partnerTag === a.tag, 'ticket is linked to A partner tag', detail.ticket?.partnerTag)
  check(detail.ticket?.category === 'BILLING', 'category persisted', detail.ticket?.category)
  check(detail.ticket?.priority === 'HIGH', 'priority persisted', detail.ticket?.priority)
  check(detail.ticket?.status === 'OPEN', 'new ticket starts OPEN', detail.ticket?.status)
  check(detail.ticket?.createdBy?.email === 'pt-23@adglobex.test', 'created-by email captured',
    detail.ticket?.createdBy?.email)
  check(detail.messages?.length === 1, 'opening description became the first message',
    `${detail.messages?.length} messages`)
  check(detail.messages?.[0]?.senderType === 'PARTNER', 'first message is from the partner')
  check(detail.messages?.[0]?.body.includes('23360179112'), 'message body preserved')
  check(detail.history?.length === 1, 'history has the CREATED entry', `${detail.history?.length}`)
  check(detail.history?.[0]?.action === 'CREATED', 'history action is CREATED')
  check(detail.ticket?.messageCount === 1, 'messageCount is 1', `${detail.ticket?.messageCount}`)

  console.log('\n=== 6. CROSS-PARTNER ISOLATION ===')
  const cross = await fetch(`${BASE}/api/p/tickets/${ticketId}`, { headers: b.headers })
  check(cross.status === 404, 'partner B gets 404 for A ticket', `status=${cross.status}`)
  const crossReply = await post(`/api/p/tickets/${ticketId}/messages`, b.headers, { body: 'hello' })
  check(crossReply.status === 409 || crossReply.status === 404,
    'partner B cannot reply to A ticket', `status=${crossReply.status}`)

  console.log('\n=== 7. REPLY ===')
  const reply = await post(`/api/p/tickets/${ticketId}/messages`, a.headers, {
    body: 'Adding the eCPM figures for that day.',
  })
  check(reply.status === 201, 'reply returns 201', `status=${reply.status}`)
  const replyBody = await reply.json()
  check(replyBody.reopened === false, 'reply on an OPEN ticket does not reopen')

  const after = await (await fetch(`${BASE}/api/p/tickets/${ticketId}`, { headers: a.headers })).json()
  check(after.messages.length === 2, 'conversation now has 2 messages', `${after.messages.length}`)
  check(after.messages[1].body.includes('eCPM'), 'second message body persisted')
  check(after.ticket.messageCount === 2, 'messageCount incremented to 2', `${after.ticket.messageCount}`)
  check(after.history.length === 2, 'history recorded the reply', `${after.history.length}`)
  check(after.history.some((h) => h.action === 'REPLIED'), 'history includes a REPLIED entry')

  const emptyReply = await post(`/api/p/tickets/${ticketId}/messages`, a.headers, { body: '   ' })
  check(emptyReply.status === 400, 'blank reply is rejected', `status=${emptyReply.status}`)

  console.log('\n=== 8. STATUS TRANSITIONS ===')
  // No partner endpoint mutates status, so set RESOLVED directly in BigQuery to
  // exercise the reopen-on-reply path the UI depends on.
  await bq.query({
    query: `UPDATE ${T('support_tickets')}
            SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP()
            WHERE ticket_id = @id AND partner_tag = @tag`,
    params: { id: ticketId, tag: a.tag },
    location: process.env.BIGQUERY_LOCATION,
  })
  const reopen = await post(`/api/p/tickets/${ticketId}/messages`, a.headers, { body: 'Still seeing the gap.' })
  check(reopen.status === 201, 'reply on a RESOLVED ticket succeeds', `status=${reopen.status}`)
  check((await reopen.json()).reopened === true, 'reply flags the ticket as reopened')
  const reopened = await (await fetch(`${BASE}/api/p/tickets/${ticketId}`, { headers: a.headers })).json()
  check(reopened.ticket.status === 'OPEN', 'status moved RESOLVED -> OPEN', reopened.ticket.status)
  check(reopened.ticket.resolvedAt === null, 'resolved_at cleared on reopen')

  // CLOSED must stay closed — only support reopens those.
  await bq.query({
    query: `UPDATE ${T('support_tickets')} SET status = 'CLOSED'
            WHERE ticket_id = @id AND partner_tag = @tag`,
    params: { id: ticketId, tag: a.tag },
    location: process.env.BIGQUERY_LOCATION,
  })
  const closedReply = await post(`/api/p/tickets/${ticketId}/messages`, a.headers, { body: 'one more' })
  check(closedReply.status === 409, 'reply on a CLOSED ticket is rejected', `status=${closedReply.status}`)

  console.log('\n=== 9. BIGQUERY PERSISTENCE ===')
  const [rows] = await bq.query({
    query: `SELECT ticket_id, partner_tag, status, category, priority, subject,
                   created_by_email, message_count
            FROM ${T('support_tickets')} WHERE ticket_id = @id`,
    params: { id: ticketId }, location: process.env.BIGQUERY_LOCATION, useQueryCache: false,
  })
  check(rows.length === 1, 'ticket row persisted to BigQuery')
  const row = rows[0]
  check(row.partner_tag === a.tag, 'stored partner_tag matches the session tag', row.partner_tag)
  check(row.subject === 'Revenue missing for 8 Oct', 'subject stored', row.subject)
  check(row.created_by_email === 'pt-23@adglobex.test', 'creator email stored', row.created_by_email)

  const [msgs] = await bq.query({
    query: `SELECT COUNT(*) AS n, MIN(partner_tag) AS tag FROM ${T('support_ticket_messages')}
            WHERE ticket_id = @id`,
    params: { id: ticketId }, location: process.env.BIGQUERY_LOCATION, useQueryCache: false,
  })
  check(Number(msgs[0].n) === 3, '3 message rows in BigQuery (open + 2 replies)', `${msgs[0].n}`)
  check(msgs[0].tag === a.tag, 'messages carry the partner tag', msgs[0].tag)

  const [hist] = await bq.query({
    query: `SELECT action FROM ${T('support_ticket_history')}
            WHERE ticket_id = @id ORDER BY created_at`,
    params: { id: ticketId }, location: process.env.BIGQUERY_LOCATION, useQueryCache: false,
  })
  const actions = hist.map((h) => h.action)
  check(actions.includes('CREATED'), 'history has CREATED', actions.join(','))
  check(actions.filter((x) => x === 'REPLIED').length === 2, 'history has 2 REPLIED entries', actions.join(','))
  // The RESOLVED -> OPEN reopen writes exactly one STATUS_CHANGED; the test's raw
  // BigQuery status writes (RESOLVED, CLOSED) are not store calls and leave no history.
  check(actions.filter((x) => x === 'STATUS_CHANGED').length === 1,
    'history has 1 STATUS_CHANGED entry (the reopen)', actions.join(','))

  console.log('\n=== 10. UI ROUTES ===')
  for (const route of ['/p/tickets', '/p/tickets/new', `/p/tickets/${ticketId}`]) {
    const r = await fetch(`${BASE}${route}`, { headers: a.headers, redirect: 'manual' })
    check(r.status === 200, `${route} renders 200`, `status=${r.status}`)
  }
  const listHtml = await (await fetch(`${BASE}/p/tickets`, { headers: a.headers })).text()
  check(listHtml.includes('Support tickets'), 'list page renders the title')
  const shell = await (await fetch(`${BASE}/p`, { headers: a.headers })).text()
  check(shell.includes('/p/tickets'), 'sidebar links to the ticket section')

  console.log('\n=== 11. RESPONSIVENESS REGRESSIONS ===')
  // The detail page once overrode .detail-grid with an inline style, which outranks
  // the @media rule that stacks it, so the layout never collapsed on narrow screens.
  // Only the dev chunks are scanned: .next/static is a production artifact that can
  // go stale while the dev server holds the port.
  const devRoot = path.join(__dirname, '..', '.next', 'dev', 'static', 'chunks')
  const built = fs.existsSync(devRoot)
    ? fs.readdirSync(devRoot, { recursive: true })
        .filter((f) => typeof f === 'string' && /\.(js|css)$/.test(f))
        .map((f) => path.join(devRoot, f))
    : []
  const readAll = (re) => built.some((f) => re.test(fs.readFileSync(f, 'utf8')))
  const cssText = built.filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(f, 'utf8')).join('\n')
  check(!readAll(/1\.5fr\s*1fr/), 'no inline gridTemplateColumns override survives in client chunks')
  check(readAll(/ticket-details/), 'ticket-details scoping class shipped in the client bundle')
  check(/\.ticket-details\s+\.kv\s*\{[^}]*grid-template-columns:\s*1fr/.test(cssText),
    'ticket DETAILS .kv is forced to a single column')
  check(/@media \(max-width: 1180px\)/.test(cssText) &&
        /\.detail-grid,\s*\.detail-grid-3\s*\{\s*grid-template-columns:\s*1fr/.test(cssText),
    'media rule still stacks .detail-grid on narrow screens')

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
