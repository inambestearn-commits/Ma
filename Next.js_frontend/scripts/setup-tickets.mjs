/* Creates the support-ticket tables in BigQuery. Idempotent — safe to re-run. */
import { BigQuery } from '@google-cloud/bigquery'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

const PROJECT = process.env.BIGQUERY_PROJECT_ID
const DATASET = process.env.BIGQUERY_DATASET
const LOCATION = process.env.BIGQUERY_LOCATION
const BQ_CRED = process.env.BIGQUERY_CREDENTIALS_JSON
const bq = new BigQuery({ projectId: PROJECT, location: LOCATION, ...(BQ_CRED && { credentials: JSON.parse(BQ_CRED) }) })
const ref = (name) => bq.dataset(DATASET).table(name)

const T = (name) => `\`${PROJECT}.${DATASET}.${name}\``

/**
 * Partitioned by day and clustered by partner_tag so every partner-scoped
 * read — which always filters on partner_tag — prunes aggressively instead of
 * scanning the whole history.
 */
const TABLES = {
  support_tickets: `
    CREATE TABLE IF NOT EXISTS ${T('support_tickets')} (
      ticket_id        STRING    NOT NULL,
      partner_tag      STRING    NOT NULL,
      created_by_user_id STRING,
      created_by_name  STRING,
      created_by_email STRING,
      subject          STRING    NOT NULL,
      description      STRING    NOT NULL,
      category         STRING    NOT NULL,
      priority         STRING    NOT NULL,
      status           STRING    NOT NULL,
      assigned_to      STRING,
      created_at       TIMESTAMP NOT NULL,
      updated_at       TIMESTAMP NOT NULL,
      resolved_at      TIMESTAMP,
      last_message_at  TIMESTAMP,
      message_count    INT64
    )
    PARTITION BY DATE(created_at)
    CLUSTER BY partner_tag, status
  `,
  support_ticket_messages: `
    CREATE TABLE IF NOT EXISTS ${T('support_ticket_messages')} (
      ticket_id      STRING    NOT NULL,
      message_id     STRING    NOT NULL,
      partner_tag    STRING    NOT NULL,
      sender_type    STRING    NOT NULL,
      sender_user_id STRING,
      sender_name    STRING,
      sender_email   STRING,
      body           STRING    NOT NULL,
      created_at     TIMESTAMP NOT NULL
    )
    PARTITION BY DATE(created_at)
    CLUSTER BY partner_tag, ticket_id
  `,
  support_ticket_history: `
    CREATE TABLE IF NOT EXISTS ${T('support_ticket_history')} (
      ticket_id      STRING    NOT NULL,
      partner_tag    STRING    NOT NULL,
      history_id     STRING    NOT NULL,
      actor_type     STRING    NOT NULL,
      actor_user_id  STRING,
      actor_name     STRING,
      action         STRING    NOT NULL,
      field          STRING,
      from_value     STRING,
      to_value       STRING,
      created_at     TIMESTAMP NOT NULL
    )
    PARTITION BY DATE(created_at)
    CLUSTER BY partner_tag, ticket_id
  `,
}

async function main() {
  for (const [name, ddl] of Object.entries(TABLES)) {
    console.log(`creating ${name} ...`)
    await bq.query({ query: ddl, location: LOCATION })
  }

  console.log('\nverifying ...')
  const [rows] = await bq.query({
    query: `SELECT table_name FROM \`${PROJECT}.${DATASET}.INFORMATION_SCHEMA.TABLES\`
            WHERE table_name LIKE 'support_ticket%' ORDER BY 1`,
    location: LOCATION,
  })
  console.log('tables:', rows.map((r) => r.table_name).join(', '))

  for (const t of rows) {
    const [cols] = await bq.query({
      query: `SELECT column_name, data_type FROM \`${PROJECT}.${DATASET}.INFORMATION_SCHEMA.COLUMNS\`
              WHERE table_name = @t ORDER BY ordinal_position`,
      params: { t: t.table_name },
      location: LOCATION,
    })
    console.log(`\n${t.table_name}: ${cols.map((c) => `${c.column_name}:${c.data_type}`).join(', ')}`)
  }
}

main().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
