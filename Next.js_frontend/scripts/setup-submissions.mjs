/* Creates the partner publisher-submission table in BigQuery. Idempotent. */
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

const T = (name) => `\`${PROJECT}.${DATASET}.${name}\``

/**
 * Every "add publisher" attempt lands here, including the ones blocked as
 * duplicates — those are the reason the table exists, since a blocked attempt is
 * otherwise invisible: the partner is told to contact the admin, and nothing is
 * left for the admin to act on.
 *
 * `status`  unread    duplicate was blocked, awaiting an admin
 *           submitted GAM accepted the createCompanies call
 *           failed    GAM call errored; error_message holds why
 *
 * `reason`  duplicate | created | gam_error
 */
const DDL = `
  CREATE TABLE IF NOT EXISTS ${T('partner_submission_requests')} (
    request_id                  STRING    NOT NULL,
    partner_tag                 STRING    NOT NULL,
    partner_email               STRING,
    partner_name                STRING,
    partner_user_id             STRING,
    site                        STRING,
    child_name                  STRING,
    gam_email                   STRING,
    network_code                STRING    NOT NULL,
    revenue_share_millipercent  INT64,
    delegation_type             STRING,
    note                        STRING,
    status                      STRING    NOT NULL,
    reason                      STRING,
    existing_partner_tag        STRING,
    existing_label              STRING,
    gam_company_id              STRING,
    gam_invitation_status       STRING,
    error_message               STRING,
    created_at                  TIMESTAMP NOT NULL,
    updated_at                  TIMESTAMP NOT NULL
  )
  PARTITION BY DATE(created_at)
  CLUSTER BY partner_tag, status
`

async function main() {
  console.log('creating partner_submission_requests ...')
  await bq.query({ query: DDL, location: LOCATION })

  const [rows] = await bq.query({
    query: `SELECT column_name, data_type
            FROM \`${PROJECT}.${DATASET}.INFORMATION_SCHEMA.COLUMNS\`
            WHERE table_name = 'partner_submission_requests'
            ORDER BY ordinal_position`,
    location: LOCATION,
  })
  console.log('columns:', rows.map((c) => `${c.column_name}:${c.data_type}`).join(', '))
}

main().catch((e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
