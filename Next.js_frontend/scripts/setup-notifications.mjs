/* Creates the notifications table in BigQuery. Idempotent — safe to re-run. */
import { BigQuery } from '@google-cloud/bigquery'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
}

// Backend resolves application tables via BIGQUERY_APP_DATASET (ma_new_data).
// The frontend .env.local only has BIGQUERY_DATASET=MA_BOT_DATA (reporting).
const PROJECT = process.env.BIGQUERY_PROJECT_ID
const DATASET = process.env.BIGQUERY_APP_DATASET || 'ma_new_data'
const LOCATION = process.env.BIGQUERY_LOCATION
const BQ_CRED = process.env.BIGQUERY_CREDENTIALS_JSON
const bq = new BigQuery({ projectId: PROJECT, location: LOCATION, ...(BQ_CRED && { credentials: JSON.parse(BQ_CRED) }) })

const T = (name) => `\`${PROJECT}.${DATASET}.${name}\``

/**
 * Partitioned by month and clustered by recipient_user_id + is_read so the
 * list endpoint — which always filters on recipient_user_id and usually on
 * is_read — prunes aggressively instead of scanning every user's history.
 *
 * No DEFAULT clauses: BigQuery does not accept DEFAULT in CREATE TABLE. The
 * backend supplies severity/is_read explicitly on INSERT, so the schema
 * defaults in notifications.sql are enforced at the write layer instead.
 */
const DDL = `
  CREATE TABLE IF NOT EXISTS ${T('notifications')} (
    notification_id   STRING    NOT NULL,
    recipient_user_id STRING    NOT NULL,
    partner_id        STRING,
    notification_type STRING    NOT NULL,
    title             STRING    NOT NULL,
    message           STRING    NOT NULL,
    severity          STRING    NOT NULL,
    is_read           BOOL      NOT NULL,
    read_at           TIMESTAMP,
    reference_type    STRING,
    reference_id      STRING,
    metadata          JSON,
    created_at        TIMESTAMP NOT NULL
  )
  PARTITION BY DATE_TRUNC(created_at, MONTH)
  CLUSTER BY recipient_user_id, is_read
`

async function main() {
  console.log('creating notifications ...')
  await bq.query({ query: DDL, location: LOCATION })

  console.log('\nverifying ...')
  const [cols] = await bq.query({
    query: `SELECT column_name, data_type FROM ${T('INFORMATION_SCHEMA.COLUMNS')}
            WHERE table_name = 'notifications' ORDER BY ordinal_position`,
    location: LOCATION,
  })
  console.log('columns:', cols.map((c) => `${c.column_name}:${c.data_type}`).join(', '))

  const [rows] = await bq.query({
    query: `SELECT COUNT(*) AS n FROM ${T('notifications')}`,
    location: LOCATION,
  })
  console.log('row count:', rows[0].n)
}

main().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
