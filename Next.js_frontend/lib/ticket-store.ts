import { randomBytes } from 'node:crypto'
import { runQuery, table, toNumber, toText } from '@/lib/bq'
import type {
  TicketCategory, TicketHistoryEntry, TicketMessage, TicketPriority, TicketRow, TicketStatus,
} from '@/lib/tickets'

/**
 * BigQuery-backed store for partner support tickets.
 *
 * Two rules hold everywhere in this file and must not be relaxed:
 *
 *  1. Every read AND every write carries `partner_tag = @partner_tag`. The tag
 *     comes from the session, never the request. A ticket id alone is never
 *     enough to reach a row, so a leaked id cannot cross partner boundaries.
 *  2. Writes are DML inside a transaction rather than streaming inserts, so a
 *     ticket is queryable the instant the request returns instead of sitting in
 *     the streaming buffer for seconds.
 *
 * Nullable string params are written as `NULLIF(@x, '')` and nullable
 * timestamps as `SAFE_CAST(@x AS TIMESTAMP)`: the driver cannot infer a type
 * for a JavaScript `null`, but both expressions turn an empty string into a
 * real SQL NULL.
 */

const TICKETS = () => table('support_tickets')
const MESSAGES = () => table('support_ticket_messages')
const HISTORY = () => table('support_ticket_history')

/** 10 hex chars — ~40 bits, far more entropy than a ticket queue ever needs. */
export function newId(prefix: string): string {
  return `${prefix}-${randomBytes(5).toString('hex').toUpperCase()}`
}

interface TicketDbRow {
  ticket_id: string
  partner_tag: string
  created_by_user_id: string | null
  created_by_name: string | null
  created_by_email: string | null
  subject: string
  description: string
  category: string
  priority: string
  status: string
  assigned_to: string | null
  created_at: unknown
  updated_at: unknown
  resolved_at: unknown
  last_message_at: unknown
  message_count: number | string | null
}

function toTicket(r: TicketDbRow): TicketRow {
  return {
    ticketId: String(r.ticket_id),
    partnerTag: String(r.partner_tag),
    subject: String(r.subject ?? ''),
    description: String(r.description ?? ''),
    category: String(r.category ?? 'OTHER') as TicketCategory,
    priority: String(r.priority ?? 'NORMAL') as TicketPriority,
    status: String(r.status ?? 'OPEN') as TicketStatus,
    assignedTo: toText(r.assigned_to),
    createdBy: {
      userId: toText(r.created_by_user_id),
      name: toText(r.created_by_name),
      email: toText(r.created_by_email),
    },
    createdAt: toText(r.created_at),
    updatedAt: toText(r.updated_at),
    resolvedAt: toText(r.resolved_at),
    lastMessageAt: toText(r.last_message_at),
    messageCount: toNumber(r.message_count),
  }
}

export interface ListTicketsFilter {
  status?: string
  category?: string
  search?: string
  page: number
  pageSize: number
}

export async function listTickets(partnerTag: string, f: ListTicketsFilter) {
  const like = `%${(f.search ?? '').toLowerCase()}%`
  const sql = `
    WITH scoped AS (
      SELECT
        t.*,
        COUNT(*) OVER() AS total_count,
        ROW_NUMBER() OVER(ORDER BY t.updated_at DESC) AS row_num
      FROM ${TICKETS()} t
      WHERE t.partner_tag = @partner_tag
        AND (@status = '' OR t.status = @status)
        AND (@category = '' OR t.category = @category)
        AND (LOWER(t.subject) LIKE @like OR LOWER(t.ticket_id) LIKE @like)
    )
    SELECT * FROM scoped
    WHERE row_num BETWEEN @offset + 1 AND @offset + @limit
    ORDER BY row_num
  `
  const { rows, bytes } = await runQuery<TicketDbRow>(sql, {
    partner_tag: partnerTag,
    status: f.status ?? '',
    category: f.category ?? '',
    like,
    limit: f.pageSize,
    offset: (f.page - 1) * f.pageSize,
  })
  return { rows: rows.map(toTicket), bytes }
}

/** One ticket, scoped. Returns null when it belongs to another partner. */
export async function getTicket(partnerTag: string, ticketId: string): Promise<TicketRow | null> {
  const sql = `SELECT * FROM ${TICKETS()} WHERE ticket_id = @ticket_id AND partner_tag = @partner_tag LIMIT 1`
  const { rows } = await runQuery<TicketDbRow>(sql, { ticket_id: ticketId, partner_tag: partnerTag })
  return rows[0] ? toTicket(rows[0]) : null
}

export async function countTickets(partnerTag: string) {
  const sql = `
    SELECT
      COUNT(*) AS total,
      COUNTIF(status IN ('OPEN','IN_PROGRESS','WAITING')) AS active,
      COUNTIF(status = 'OPEN') AS open_count,
      COUNTIF(status = 'IN_PROGRESS') AS in_progress,
      COUNTIF(status = 'WAITING') AS waiting,
      COUNTIF(status = 'RESOLVED') AS resolved,
      COUNTIF(status = 'CLOSED') AS closed
    FROM ${TICKETS()}
    WHERE partner_tag = @partner_tag
  `
  const { rows } = await runQuery(sql, { partner_tag: partnerTag })
  const r = rows[0] as Record<string, unknown> | undefined
  return {
    total: toNumber(r?.total),
    active: toNumber(r?.active),
    open: toNumber(r?.open_count),
    inProgress: toNumber(r?.in_progress),
    waiting: toNumber(r?.waiting),
    resolved: toNumber(r?.resolved),
    closed: toNumber(r?.closed),
  }
}

interface MessageDbRow {
  message_id: string
  ticket_id: string
  sender_type: string
  sender_name: string | null
  sender_email: string | null
  body: string
  created_at: unknown
}

export async function listMessages(partnerTag: string, ticketId: string): Promise<TicketMessage[]> {
  const sql = `
    SELECT * FROM ${MESSAGES()}
    WHERE ticket_id = @ticket_id AND partner_tag = @partner_tag
    ORDER BY created_at, message_id
  `
  const { rows } = await runQuery<MessageDbRow>(sql, { ticket_id: ticketId, partner_tag: partnerTag })
  return rows.map((r) => ({
    messageId: String(r.message_id),
    ticketId: String(r.ticket_id),
    senderType: String(r.sender_type) as 'PARTNER' | 'SUPPORT',
    senderName: toText(r.sender_name),
    senderEmail: toText(r.sender_email),
    body: String(r.body ?? ''),
    createdAt: toText(r.created_at),
  }))
}

interface HistoryDbRow {
  history_id: string
  action: string
  field: string | null
  from_value: string | null
  to_value: string | null
  actor_type: string
  actor_name: string | null
  created_at: unknown
}

export async function listHistory(partnerTag: string, ticketId: string): Promise<TicketHistoryEntry[]> {
  const sql = `
    SELECT * FROM ${HISTORY()}
    WHERE ticket_id = @ticket_id AND partner_tag = @partner_tag
    ORDER BY created_at, history_id
  `
  const { rows } = await runQuery<HistoryDbRow>(sql, { ticket_id: ticketId, partner_tag: partnerTag })
  return rows.map((r) => ({
    historyId: String(r.history_id),
    action: String(r.action),
    field: toText(r.field),
    fromValue: toText(r.from_value),
    toValue: toText(r.to_value),
    actorType: String(r.actor_type) as 'PARTNER' | 'SUPPORT' | 'SYSTEM',
    actorName: toText(r.actor_name),
    createdAt: toText(r.created_at),
  }))
}

export interface CreateTicketInput {
  partnerTag: string
  userId: string | null
  name: string | null
  email: string | null
  subject: string
  description: string
  category: TicketCategory
  priority: TicketPriority
}

/**
 * Files a ticket and its opening message + audit entry in one transaction, so
 * a failure can never leave a ticket with no conversation or a conversation
 * with no ticket.
 */
export async function createTicket(input: CreateTicketInput): Promise<string> {
  const ticketId = newId('TCK')
  const messageId = newId('MSG')
  const historyId = newId('HIS')
  const now = new Date().toISOString()

  const sql = `
    BEGIN TRANSACTION;

    INSERT INTO ${TICKETS()}
      (ticket_id, partner_tag, created_by_user_id, created_by_name, created_by_email,
       subject, description, category, priority, status, assigned_to,
       created_at, updated_at, resolved_at, last_message_at, message_count)
    VALUES
      (@ticket_id, @partner_tag, NULLIF(@user_id, ''), NULLIF(@name, ''), NULLIF(@email, ''),
       @subject, @description, @category, @priority, 'OPEN', NULL,
       SAFE_CAST(@now AS TIMESTAMP), SAFE_CAST(@now AS TIMESTAMP), NULL,
       SAFE_CAST(@now AS TIMESTAMP), 1);

    INSERT INTO ${MESSAGES()}
      (ticket_id, message_id, partner_tag, sender_type, sender_user_id, sender_name, sender_email,
       body, created_at)
    VALUES
      (@ticket_id, @message_id, @partner_tag, 'PARTNER', NULLIF(@user_id, ''), NULLIF(@name, ''),
       NULLIF(@email, ''), @description, SAFE_CAST(@now AS TIMESTAMP));

    INSERT INTO ${HISTORY()}
      (ticket_id, partner_tag, history_id, actor_type, actor_user_id, actor_name,
       action, field, from_value, to_value, created_at)
    VALUES
      (@ticket_id, @partner_tag, @history_id, 'PARTNER', NULLIF(@user_id, ''), NULLIF(@name, ''),
       'CREATED', NULL, NULL, @category, SAFE_CAST(@now AS TIMESTAMP));

    COMMIT TRANSACTION;
  `

  await runQuery(sql, {
    ticket_id: ticketId,
    message_id: messageId,
    history_id: historyId,
    partner_tag: input.partnerTag,
    user_id: input.userId ?? '',
    name: input.name ?? '',
    email: input.email ?? '',
    subject: input.subject,
    description: input.description,
    category: input.category,
    priority: input.priority,
    now,
  })

  return ticketId
}

/**
 * Appends a partner reply. Reopening a RESOLVED ticket is deliberate: a
 * partner replying to a closed thread means the fix did not hold, so the
 * ticket goes back to OPEN rather than silently swallowing the message.
 * CLOSED stays closed — only support reopens those.
 */
export async function addPartnerMessage(input: {
  partnerTag: string
  ticketId: string
  userId: string | null
  name: string | null
  email: string | null
  body: string
}): Promise<{ ok: boolean; reopened: boolean }> {
  // Resolve the current status first so the UPDATE and the history entry
  // describe the same transition. Scoped by tag, so another partner's ticket
  // is invisible here.
  const current = await getTicket(input.partnerTag, input.ticketId)
  if (!current) return { ok: false, reopened: false }
  if (current.status === 'CLOSED') return { ok: false, reopened: false }

  const messageId = newId('MSG')
  const historyId = newId('HIS')
  const now = new Date().toISOString()
  const reopened = current.status === 'RESOLVED'
  const nextStatus = reopened ? 'OPEN' : current.status

  const sql = `
    BEGIN TRANSACTION;

    INSERT INTO ${MESSAGES()}
      (ticket_id, message_id, partner_tag, sender_type, sender_user_id, sender_name, sender_email,
       body, created_at)
    VALUES
      (@ticket_id, @message_id, @partner_tag, 'PARTNER', NULLIF(@user_id, ''), NULLIF(@name, ''),
       NULLIF(@email, ''), @body, SAFE_CAST(@now AS TIMESTAMP));

    UPDATE ${TICKETS()}
    SET message_count = message_count + 1,
        last_message_at = SAFE_CAST(@now AS TIMESTAMP),
        updated_at = SAFE_CAST(@now AS TIMESTAMP),
        status = @next_status,
        resolved_at = IF(@reopened = 'true', NULL, resolved_at)
    WHERE ticket_id = @ticket_id AND partner_tag = @partner_tag;

    INSERT INTO ${HISTORY()}
      (ticket_id, partner_tag, history_id, actor_type, actor_user_id, actor_name,
       action, field, from_value, to_value, created_at)
    VALUES
      (@ticket_id, @partner_tag, @history_id, 'PARTNER', NULLIF(@user_id, ''), NULLIF(@name, ''),
       'REPLIED', NULL, NULL, NULL, SAFE_CAST(@now AS TIMESTAMP));

    IF @reopened = 'true' THEN
      INSERT INTO ${HISTORY()}
        (ticket_id, partner_tag, history_id, actor_type, actor_user_id, actor_name,
         action, field, from_value, to_value, created_at)
      VALUES
        (@ticket_id, @partner_tag, CONCAT(@history_id, '-R'), 'PARTNER', NULLIF(@user_id, ''),
         NULLIF(@name, ''), 'STATUS_CHANGED', 'status', @from_status, @next_status,
         SAFE_CAST(@now AS TIMESTAMP));
    END IF;

    COMMIT TRANSACTION;
  `

  await runQuery(sql, {
    ticket_id: input.ticketId,
    message_id: messageId,
    history_id: historyId,
    partner_tag: input.partnerTag,
    user_id: input.userId ?? '',
    name: input.name ?? '',
    email: input.email ?? '',
    body: input.body,
    from_status: current.status,
    next_status: nextStatus,
    reopened: reopened ? 'true' : 'false',
    now,
  })

  return { ok: true, reopened }
}
