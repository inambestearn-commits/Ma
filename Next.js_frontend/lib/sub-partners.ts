/**
 * Sub-partner BigQuery helpers.
 *
 * Sub-partners are provisioned by a parent partner from the portal. Each one
 * gets:
 *   - A Supabase auth account (created via the service-role client)
 *   - A row in `ma_new_data.sub_partners` in BigQuery
 *   - A partner_tag in Supabase app_metadata derived from the parent ticket:
 *       parent ticket "AHQ"  → sub-partner tag "ahq-01", "ahq-02", …
 *       parent ticket "PT-24" → sub-partner tag "pt-24-01", "pt-24-02", …
 *
 * The sub-partner tag is the BigQuery security boundary — all existing partner
 * portal queries already scope data by `partner_tag`, so a sub-partner with
 * their own Supabase account and tag sees only their own sites automatically.
 *
 * BigQuery table DDL (run once in BigQuery console):
 *
 *   CREATE TABLE IF NOT EXISTS `adblobex.ma_new_data.sub_partners` (
 *     sub_partner_id   STRING NOT NULL,
 *     parent_tag       STRING NOT NULL,
 *     parent_ticket    STRING NOT NULL,
 *     sub_ticket       STRING NOT NULL,   -- e.g. "AHQ/01"
 *     sub_tag          STRING NOT NULL,   -- e.g. "ahq-01"
 *     name             STRING NOT NULL,
 *     email            STRING NOT NULL,
 *     revenue_share    FLOAT64 NOT NULL,  -- parent's minimum share %
 *     status           STRING NOT NULL,   -- ACTIVE | DISABLED
 *     auth_user_id     STRING,
 *     created_at       TIMESTAMP NOT NULL,
 *     updated_at       TIMESTAMP NOT NULL,
 *   );
 */

import { randomBytes } from 'node:crypto'
import { appTable, runQuery, toNumber, toText } from '@/lib/bq'

export interface SubPartner {
  subPartnerId: string
  parentTag: string
  parentTicket: string
  subTicket: string   // display form: "AHQ/01"
  subTag: string      // Supabase / BigQuery form: "ahq-01"
  name: string
  email: string
  revenueShare: number
  status: string
  authUserId: string | null
  createdAt: string | null
}

const TABLE = () => appTable('sub_partners')

const SUB_PARTNER_COLUMNS = `sub_partner_id, parent_tag, parent_ticket, sub_ticket, sub_tag,
            name, email, revenue_share, status, auth_user_id, created_at`

interface SubPartnerRow {
  sub_partner_id: string
  parent_tag: string
  parent_ticket: string
  sub_ticket: string
  sub_tag: string
  name: string
  email: string
  revenue_share: unknown
  status: string
  auth_user_id: string | null
  created_at: unknown
}

function toSubPartner(r: SubPartnerRow): SubPartner {
  return {
    subPartnerId: String(r.sub_partner_id ?? ''),
    parentTag: String(r.parent_tag ?? ''),
    parentTicket: String(r.parent_ticket ?? ''),
    subTicket: String(r.sub_ticket ?? ''),
    subTag: String(r.sub_tag ?? ''),
    name: String(r.name ?? ''),
    email: String(r.email ?? ''),
    revenueShare: toNumber(r.revenue_share),
    status: String(r.status ?? 'ACTIVE'),
    authUserId: r.auth_user_id ? String(r.auth_user_id) : null,
    createdAt: toText(r.created_at),
  }
}

export const newSubPartnerId = () =>
  `SP-${randomBytes(5).toString('hex').toUpperCase()}`

/**
 * Derive the sub-partner tag from the parent ticket and a sequence number.
 *   "AHQ"   + 1  →  "ahq-01"
 *   "PT-24" + 2  →  "pt-24-02"
 */
export function buildSubTag(parentTicket: string, seq: number): string {
  const base = parentTicket.trim().toLowerCase()
  return `${base}-${String(seq).padStart(2, '0')}`
}

/**
 * The display ticket string.
 *   "AHQ" + 1  →  "AHQ/01"
 */
export function buildSubTicket(parentTicket: string, seq: number): string {
  return `${parentTicket.trim().toUpperCase()}/${String(seq).padStart(2, '0')}`
}

/**
 * Count how many sub-partners this parent already has, so we can derive the
 * next sequence number.
 */
export async function countSubPartners(parentTag: string): Promise<number> {
  const { rows } = await runQuery<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ${TABLE()} WHERE parent_tag = @parent_tag`,
    { parent_tag: parentTag },
  )
  return toNumber(rows[0]?.n ?? 0)
}

/**
 * Is this tag a sub-partner account rather than a parent partner?
 *
 * Sub-partners manage nobody, so the sub-partner section is hidden for them.
 * Answered from the table (not the session metadata) so a manually provisioned
 * account cannot slip past.
 */
export async function isSubPartnerTag(tag: string): Promise<boolean> {
  const { rows } = await runQuery<{ hit: number }>(
    `SELECT 1 AS hit FROM ${TABLE()} WHERE LOWER(sub_tag) = @tag LIMIT 1`,
    { tag },
  )
  return rows.length > 0
}

/** List all sub-partners for a given parent tag. */
export async function listSubPartners(parentTag: string): Promise<SubPartner[]> {
  const { rows } = await runQuery<SubPartnerRow>(
    `SELECT ${SUB_PARTNER_COLUMNS}
     FROM ${TABLE()}
     WHERE parent_tag = @parent_tag
     ORDER BY created_at ASC`,
    { parent_tag: parentTag },
  )
  return rows.map(toSubPartner)
}

/**
 * Resolve one sub-partner by its login tag (e.g. "ahq-01").
 *
 * Sub-partners have no row in `partners`, so a session that cannot resolve
 * there is checked here; `revenue_share` is the parent share its partner set
 * when creating it, which is the floor the publisher form must show.
 */
export async function getSubPartnerByTag(tag: string): Promise<SubPartner | null> {
  const { rows } = await runQuery<SubPartnerRow>(
    `SELECT ${SUB_PARTNER_COLUMNS}
     FROM ${TABLE()}
     WHERE LOWER(sub_tag) = @tag
     LIMIT 1`,
    { tag },
  )
  return rows[0] ? toSubPartner(rows[0]) : null
}

export interface InsertSubPartnerInput {
  subPartnerId: string
  parentTag: string
  parentTicket: string
  subTicket: string
  subTag: string
  name: string
  email: string
  revenueShare: number
  authUserId: string | null
}

/** Insert a new sub-partner row into BigQuery. */
export async function insertSubPartner(input: InsertSubPartnerInput): Promise<void> {
  const now = new Date().toISOString()

  await runQuery(
    `INSERT INTO ${TABLE()}
       (sub_partner_id, parent_tag, parent_ticket, sub_ticket, sub_tag,
        name, email, revenue_share, status, auth_user_id, created_at, updated_at)
     VALUES
       (@sub_partner_id, @parent_tag, @parent_ticket, @sub_ticket, @sub_tag,
        @name, @email, @revenue_share, @status, @auth_user_id, @created_at, @updated_at)`,
    {
      sub_partner_id: input.subPartnerId,
      parent_tag: input.parentTag,
      parent_ticket: input.parentTicket,
      sub_ticket: input.subTicket,
      sub_tag: input.subTag,
      name: input.name,
      email: input.email,
      revenue_share: input.revenueShare,
      status: 'ACTIVE',
      auth_user_id: input.authUserId ?? '',
      created_at: now,
      updated_at: now,
    },
  )
}
