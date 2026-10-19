/**
 * API access layer.
 *
 * Every screen gets data through these functions — never by importing datasets
 * directly.
 *
 * Each function first calls the Django backend with the Supabase session
 * token (`lib/backend.ts`). When the endpoint is missing, errors, or returns
 * an unusable shape, the function falls back to the local dummy dataset so
 * every screen keeps working. Backend tables for notifications, payments,
 * revenue, policies and rules are not provisioned in BigQuery yet, so those
 * screens currently serve dummy data.
 *
 * Nothing else in the app needs to change.
 */

import { partners, partnerUsers, profiles } from '@/lib/data/partners'
import { publisherSites } from '@/lib/data/sites'
import { alertEvents, autoActions, rules } from '@/lib/data/rules'
import { csvImports, payments, revenueRecords, statements } from '@/lib/data/finance'
import { integrationContract, inviteLog, mcmConnections, mcmRelationships } from '@/lib/data/mcm'
import {
  activityFeed, auditLog, dashboardSummary, healthChecks, notifications, partnerDashboardSummary,
  partnerTrend, policyIssues, reportRows, revenueTrend,
} from '@/lib/data/operations'
import type {
  AlertEvent, AppNotification, AuditEvent, CsvImport, DashboardSummary, HealthCheck, McmRelationship,
  Page, Partner, PartnerUser, Payment, PolicyIssue, Portal, PublisherSite, ReportRow, RevenueRecord,
  Rule, SmartNotification, Statement,
} from '@/lib/data/types'
import { ApiError, BACKEND_URL, backendFetch, search } from '@/lib/backend'
import type { DateRange } from '@/lib/date'

export { ApiError, BACKEND_URL }

const LATENCY = 180

function resolve<T>(value: T, latency = LATENCY): Promise<T> {
  return new Promise((res) => setTimeout(() => res(structuredClone(value)), latency))
}

export interface ListQuery {
  search?: string
  status?: string
  page?: number
  page_size?: number
}

function paginate<T>(rows: T[], q: ListQuery = {}): Page<T> {
  const page = Math.max(1, q.page ?? 1)
  const page_size = q.page_size ?? 25
  const start = (page - 1) * page_size
  return { count: rows.length, results: rows.slice(start, start + page_size), page, page_size }
}

function match(needle: string | undefined, ...fields: (string | undefined)[]) {
  if (!needle) return true
  const n = needle.toLowerCase()
  return fields.some((f) => (f ?? '').toLowerCase().includes(n))
}

/* --------------------------- Backend helpers ----------------------------- */

interface BackendList<T> {
  results?: T[]
  count?: number
  total_count?: number
  page?: number
  page_size?: number
}

function initialsOf(name: string, email: string): string {
  const source = name || email.split('@')[0] || ''
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function titleCaseRole(role: string): string {
  return role
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function shortDate(iso: string): string {
  const value = iso.length === 10 ? `${iso}T00:00:00Z` : iso
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' })
}

function formatTimestamp(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-US', {
    month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  })
}

/* ---------------------------------- Auth ---------------------------------- */

export const auth = {
  login: (_email: string, _password: string) =>
    resolve({ user: profiles.admin, access_token: 'dummy-access', refresh_token: 'dummy-refresh' }, 320),
  signup: (_email: string, _password: string, _name: string) =>
    resolve({ user: profiles.admin, access_token: 'dummy-access', refresh_token: 'dummy-refresh' }, 320),
  logout: () => resolve({ ok: true }, 120),
}

export interface DisplayProfile {
  full_name: string
  email: string
  role: string
  initials: string
  partner_ticket: string | null
}

interface RawProfile {
  full_name?: string | null
  email?: string | null
  role?: string | null
  role_key?: string | null
}

export async function getProfile(portal: Portal): Promise<DisplayProfile> {
  if (portal === 'admin') {
    try {
      const raw = await backendFetch<RawProfile>('/api/v1/auth/profile/')
      const fullName = (raw.full_name || '').trim()
      const email = (raw.email || '').trim()
      const roleKey = (raw.role_key || raw.role || '').trim()
      if (fullName || email) {
        return {
          full_name: fullName || email.split('@')[0] || 'Admin',
          email,
          role: roleKey ? titleCaseRole(roleKey) : 'Admin',
          initials: initialsOf(fullName, email),
          partner_ticket: null,
        }
      }
    } catch {
      // fall through to the dummy profile
    }
  }
  return resolve(profiles[portal], 100)
}

/* -------------------------------- Partners -------------------------------- */

interface RawPartner {
  partner_id: string
  partner_ticket: string
  name: string
  primary_email: string | null
  status: string
  created_at: string
  updated_at: string
}

interface RecentPartnerRow {
  partner_ticket?: string
  total_sites?: number
  active_sites?: number
  revenue?: number
}

type PartnerStats = Map<string, { sites: number; active_sites: number; revenue: number }>

let partnerStatsCache: { at: number; stats: PartnerStats } | null = null

async function fetchPartnerStats(): Promise<PartnerStats> {
  if (partnerStatsCache && Date.now() - partnerStatsCache.at < 30_000) return partnerStatsCache.stats
  const data = await backendFetch<{ results?: RecentPartnerRow[] }>(
    '/api/v1/reports/ma-dashboard/recent-partners/' + search({ limit: 50 }),
  )
  const stats: PartnerStats = new Map()
  for (const row of data.results ?? []) {
    if (!row.partner_ticket) continue
    stats.set(row.partner_ticket, {
      sites: row.total_sites ?? 0,
      active_sites: row.active_sites ?? 0,
      revenue: row.revenue ?? 0,
    })
  }
  partnerStatsCache = { at: Date.now(), stats }
  return stats
}

function mapPartner(raw: RawPartner, stats: PartnerStats): Partner {
  const s = stats.get(raw.partner_ticket)
  return {
    id: raw.partner_id,
    partner_ticket: raw.partner_ticket,
    name: raw.name,
    type: 'Media partner',
    contact_name: '',
    contact_email: raw.primary_email ?? '',
    revenue_share: 0,
    status: (raw.status as Partner['status']) || 'ACTIVE',
    sites: s?.sites ?? 0,
    active_sites: s?.active_sites ?? 0,
    revenue: s?.revenue ?? 0,
    mcm: '',
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    last_login: null,
    notes: '',
  }
}

export async function listPartners(q: ListQuery = {}): Promise<Page<Partner>> {
  try {
    const [data, stats] = await Promise.all([
      backendFetch<BackendList<RawPartner>>(
        '/api/v1/partners/' + search({ page: q.page ?? 1, page_size: q.page_size ?? 25 }),
      ),
      fetchPartnerStats().catch(() => null),
    ])
    const rows = (data.results ?? []).map((r) => mapPartner(r, stats ?? new Map()))
    const filtered = rows.filter(
      (p) => match(q.search, p.name, p.partner_ticket, p.contact_email, p.contact_name) &&
        (!q.status || p.status === q.status),
    )
    return {
      count: data.total_count ?? data.count ?? filtered.length,
      results: filtered,
      page: data.page ?? q.page ?? 1,
      page_size: data.page_size ?? q.page_size ?? 25,
    }
  } catch {
    const rows = partners.filter(
      (p) => match(q.search, p.name, p.partner_ticket, p.contact_email, p.contact_name) &&
        (!q.status || p.status === q.status),
    )
    return paginate(rows, q)
  }
}

export async function getPartner(id: string): Promise<Partner | undefined> {
  try {
    const raw = await backendFetch<RawPartner>(`/api/v1/partners/${encodeURIComponent(id)}/`)
    const stats = await fetchPartnerStats().catch(() => null)
    return mapPartner(raw, stats ?? new Map())
  } catch {
    try {
      const list = await backendFetch<BackendList<RawPartner>>(
        '/api/v1/partners/' + search({ page_size: 200 }),
      )
      const stats = await fetchPartnerStats().catch(() => null)
      const raw = (list.results ?? []).find(
        (p) => p.partner_id === id || p.partner_ticket === id,
      )
      if (raw) return mapPartner(raw, stats ?? new Map())
    } catch {
      // fall through to the dummy dataset
    }
  }
  const found = partners.find((p) => p.id === id || p.partner_ticket === id)
  return found ? structuredClone(found) : undefined
}

export function listPartnerUsers(partnerTicket?: string): Promise<Page<PartnerUser>> {
  // No backend endpoint yet (user management is a future phase).
  const rows = partnerUsers.filter((u) => !partnerTicket || u.partner_ticket === partnerTicket)
  return resolve(paginate(rows))
}

export interface CreatePartnerInput {
  ticket: string
  name: string
  email: string
  password: string
  max_revenue_share?: number | null
}

interface RawPartnerCreateResponse {
  partner_id: string
  partner_ticket: string
  partner_tag: string
  name: string
  primary_email: string
  status: string
  max_revenue_share: number | null
  auth_user_id: string
  role_key: string
}

/**
 * Create a Partner on the backend. Unlike reads, this never falls back to
 * dummy data — a write either succeeds or surfaces the error to the caller.
 */
export async function createPartner(input: CreatePartnerInput): Promise<Partner> {
  const raw = await backendFetch<RawPartnerCreateResponse>('/api/v1/partners/', {
    method: 'POST',
    body: JSON.stringify({
      ticket: input.ticket,
      name: input.name,
      email: input.email,
      password: input.password,
      ...(input.max_revenue_share != null
        ? { max_revenue_share: input.max_revenue_share }
        : {}),
    }),
  })
  return {
    id: raw.partner_id,
    partner_ticket: raw.partner_ticket,
    name: raw.name,
    type: 'Media partner',
    contact_name: '',
    contact_email: raw.primary_email,
    revenue_share: raw.max_revenue_share ?? 0,
    status: (raw.status as Partner['status']) || 'ACTIVE',
    sites: 0,
    active_sites: 0,
    revenue: 0,
    mcm: '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_login: null,
    notes: '',
  }
}

/* --------------------------- Sites / Publishers --------------------------- */

interface RawPublisher {
  relationship_id?: string
  site_id?: string
  partner_ticket?: string | null
  partner_name?: string | null
  publisher_ticket?: string | null
  display_identity?: string | null
  canonical_domain?: string | null
  publisher_email?: string | null
  lifecycle_status?: string | null
  mcm_connection_id?: string | null
  child_share_percent?: number | null
  effective_from?: string | null
  created_at?: string | null
  updated_at?: string | null
}

function mapPublisher(raw: RawPublisher): PublisherSite {
  const status = (raw.lifecycle_status ?? 'DRAFT') as PublisherSite['status']
  return {
    id: raw.relationship_id ?? raw.site_id ?? '',
    publisher_ticket: raw.publisher_ticket ?? '',
    site: raw.display_identity ?? raw.canonical_domain ?? '',
    canonical_site: raw.canonical_domain ?? '',
    partner_ticket: raw.partner_ticket ?? '',
    partner_name: raw.partner_name ?? '',
    status,
    api_status:
      status === 'ACTIVE' ? 'OK' : status === 'INVITED' || status === 'PENDING' ? 'SYNCING' : 'NOT_INVITED',
    delegation: 'MA',
    ads_txt: 'Unverified',
    publisher_email: raw.publisher_email ?? '',
    network_code: '',
    revenue_share: raw.child_share_percent ?? 0,
    mcm: raw.mcm_connection_id ?? '',
    last_invite: raw.effective_from ?? null,
    onboarding_date: (raw.created_at ?? '').slice(0, 10),
    updated_at: raw.updated_at ?? '',
  }
}

const PUBLISHER_PAGE_SIZE = 200
const PUBLISHER_MAX_PAGES = 10
let publisherCache: { at: number; rows: PublisherSite[] } | null = null

async function fetchAllPublishers(): Promise<PublisherSite[]> {
  if (publisherCache && Date.now() - publisherCache.at < 30_000) return publisherCache.rows
  const rows: PublisherSite[] = []
  for (let page = 1; page <= PUBLISHER_MAX_PAGES; page++) {
    const data = await backendFetch<BackendList<RawPublisher>>(
      '/api/v1/publishers/' + search({ page, page_size: PUBLISHER_PAGE_SIZE }),
    )
    const chunk = data.results ?? []
    rows.push(...chunk.map(mapPublisher))
    if (chunk.length < PUBLISHER_PAGE_SIZE) break
  }
  publisherCache = { at: Date.now(), rows }
  return rows
}

export async function listSites(q: ListQuery = {}): Promise<Page<PublisherSite>> {
  try {
    const rows = await fetchAllPublishers()
    const filtered = rows.filter(
      (s) => match(q.search, s.site, s.partner_name, s.partner_ticket, s.publisher_email) &&
        (!q.status || s.status === q.status.toUpperCase()),
    )
    return paginate(filtered, q)
  } catch {
    const rows = publisherSites.filter(
      (s) => match(q.search, s.site, s.partner_name, s.partner_ticket, s.publisher_email) &&
        (!q.status || s.status === q.status.toUpperCase()),
    )
    return paginate(rows, q)
  }
}

export function listPartnerSites(partnerTicket: string, q: ListQuery = {}): Promise<Page<PublisherSite>> {
  return listSites({ ...q, search: q.search })
    .then((page) => ({ ...page, results: page.results.filter((s) => s.partner_ticket === partnerTicket) }))
}

export function onboardPublisher(_input: Partial<PublisherSite>): Promise<PublisherSite> {
  return resolve(publisherSites[0], 420)
}

/* ------------------------- Manage publishers (admin) ----------------------- */

/** One row of GET /api/v1/publishers/manage/ — GAM child publisher inventory. */
export interface ManagePublisherRow {
  network_code: string
  label: string | null
  network_name: string | null
  account_status: string | null
  invitation_status: string | null
  delegation_type: string | null
  approval_status: string | null
  revenue_share_millipercent: number | null
  email: string | null
  seller_id: string | null
  child_publisher_id: string | null
  last_modified_at: string | null
  active_since: string | null
  declined_at: string | null
  source: string | null
  last_synced_at: string | null
  created_at: string | null
  updated_at: string | null
}

/** Per-bucket tab counts for the full inventory (not affected by search/status). */
export interface ManagePublisherCounts {
  all: number
  approved: number
  pending: number
  invited: number
  withdrawal_by_child: number
  withdrawn: number
  policy: number
  ivt: number
  not_approved: number
  inactive: number
}

export interface ManagePublishersPage {
  results: ManagePublisherRow[]
  total_count: number
  page: number
  page_size: number
  counts: ManagePublisherCounts
}

/**
 * Admin GAM child publisher inventory. Unlike the rest of api.ts there is no
 * dummy fallback: the endpoint exists, and a failure should surface as an
 * error state with retry rather than fabricated rows.
 */
export async function listManagePublishers(q: ListQuery = {}): Promise<ManagePublishersPage> {
  return backendFetch<ManagePublishersPage>(
    '/api/v1/publishers/manage/' +
      search({
        search: q.search,
        status: q.status && q.status !== 'all' ? q.status : undefined,
        page: q.page ?? 1,
        page_size: q.page_size ?? 25,
      }),
  )
}

/* --------------------------------- Rules ---------------------------------- */

export function listRules(scope?: Rule['scope'], q: ListQuery = {}): Promise<Page<Rule>> {
  // Backend rule tables (global_rules/partner_rules/site_rule_overrides) are
  // not provisioned in BigQuery yet — endpoint currently 500s.
  const rows = rules.filter(
    (r) => (!scope || r.scope === scope) && match(q.search, r.rule_key, r.partner_ticket, r.site),
  )
  return resolve(paginate(rows, q))
}

export function listAlerts(q: ListQuery = {}): Promise<Page<AlertEvent>> {
  // Backend alert_events table is not provisioned in BigQuery yet.
  const rows = alertEvents.filter(
    (a) => match(q.search, a.site, a.partner_ticket, a.rule_key) && (!q.status || a.status === q.status),
  )
  return resolve(paginate(rows, q))
}

export const autoActionList = () => resolve(autoActions)

/* -------------------------------- Reporting ------------------------------- */

interface DashboardMetrics {
  ctr?: number
  clicks?: number
  fill_rate?: number
  revenue?: number
  ad_requests?: number
  impressions?: number
  ecpm?: number
}

interface SystemHealth {
  total_partners?: number
  active_partners?: number
  total_sites?: number
  active_sites?: number
  pending_sites?: number
  invited_sites?: number
  mcm_last_sync?: string | null
}

/** Appends `?start=&end=` when a range is supplied. The backend requires both
 *  ends together and defaults to the last 30 days when they are omitted. */
function rangeQuery(range?: DateRange): string {
  return range ? `?start=${range.from}&end=${range.to}` : ''
}

export async function getDashboard(portal: Portal, range?: DateRange): Promise<DashboardSummary> {
  if (portal === 'admin') {
    try {
      const [metrics, system] = await Promise.all([
        backendFetch<DashboardMetrics>(`/api/v1/reports/dashboard/${rangeQuery(range)}`),
        backendFetch<SystemHealth>('/api/v1/health/system/'),
      ])
      const revenue = metrics.revenue ?? 0
      return {
        revenue,
        impressions: metrics.impressions ?? 0,
        clicks: metrics.clicks ?? 0,
        ecpm: metrics.ecpm ?? 0,
        ctr: metrics.ctr ?? 0,
        ad_requests: metrics.ad_requests ?? 0,
        fill_rate: metrics.fill_rate ?? 0,
        gross_revenue: revenue,
        parent_share: 0,
        total_publishers: system.total_partners ?? 0,
        active_publishers: system.active_partners ?? 0,
      }
    } catch {
      // fall through to the dummy summary
    }
  }
  return resolve(portal === 'admin' ? dashboardSummary : partnerDashboardSummary, 260)
}

const REPORT_METRICS = ['impressions', 'clicks', 'revenue', 'ad_requests'] as const

function groupReportRows(dimensions: string[]): ReportRow[] {
  if (dimensions.length === 0) return reportRows

  const groups = new Map<string, ReportRow>()
  for (const row of reportRows) {
    const key = dimensions.map((d) => String(row[d as keyof ReportRow])).join('|')
    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, { ...row })
      continue
    }
    for (const metric of REPORT_METRICS) existing[metric] += row[metric]
  }

  return Array.from(groups.values()).map((r) => ({
    ...r,
    ecpm: r.impressions ? (r.revenue / r.impressions) * 1000 : 0,
    ctr: r.impressions ? (r.clicks / r.impressions) * 100 : 0,
    fill_rate: r.ad_requests ? Math.round((r.impressions / r.ad_requests) * 1000) / 10 : 0,
  }))
}

interface RawReportRow {
  [key: string]: string | number | null | undefined
}

/** Loose wire shape from `SELECT *` on the BigQuery notifications table. */
interface RawNotification {
  notification_id?: string | null
  recipient_user_id?: string | null
  partner_id?: string | null
  notification_type?: string | null
  title?: string | null
  message?: string | null
  severity?: string | null
  is_read?: boolean | null
  reference_type?: string | null
  reference_id?: string | null
  created_at?: string | null
}

/** Map a raw warehouse row into ReportRow, preserving network_code when present. */
function toReportRow(r: RawReportRow): ReportRow {
  return {
    site: String(r.site ?? ''),
    traffic_source: String(r.traffic_source ?? ''),
    device: String(r.device ?? ''),
    country: String(r.country ?? ''),
    carrier: String(r.carrier ?? ''),
    browser: String(r.browser ?? ''),
    network_code: r.network_code === null || r.network_code === undefined
      ? undefined
      : String(r.network_code),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    revenue: Number(r.revenue ?? 0),
    ecpm: Number(r.ecpm ?? 0),
    ctr: Number(r.ctr ?? 0),
    ad_requests: Number(r.ad_requests ?? 0),
    fill_rate: Number(r.fill_rate ?? 0),
    applicable_revenue: r.applicable_revenue === undefined ? undefined : Number(r.applicable_revenue),
    not_applicable_revenue: r.not_applicable_revenue === undefined ? undefined : Number(r.not_applicable_revenue),
    ios_pct: r.ios_pct === undefined ? undefined : Number(r.ios_pct),
  }
}

const BASE_QUERY_METRICS = ['impressions', 'clicks', 'revenue', 'ecpm', 'ctr', 'ad_requests', 'fill_rate'] as const
const SITE_EXTRA_METRICS = ['applicable_revenue', 'not_applicable_revenue', 'ios_pct'] as const

function metricsFor(dimensions: string[]): string[] {
  return dimensions.includes('site') ? [...BASE_QUERY_METRICS, ...SITE_EXTRA_METRICS] : [...BASE_QUERY_METRICS]
}

export async function queryReport(
  dimensions: string[],
  q: ListQuery = {},
  range?: DateRange,
): Promise<Page<ReportRow>> {
  try {
    const end = range?.to ?? isoDay(new Date())
    const start = range?.from ?? isoDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    const data = await backendFetch<{
      results?: RawReportRow[]
      total_count?: number
      page?: number
      page_size?: number
      blocked_dimensions?: string[]
    }>('/api/v1/reports/query/', {
      method: 'POST',
      body: JSON.stringify({
        date_range: { start, end },
        dimensions,
        metrics: metricsFor(dimensions),
        page: q.page ?? 1,
        page_size: Math.min(q.page_size ?? 50, 500),
      }),
    })

    const results = data.results ?? []
    const blocked = new Set(data.blocked_dimensions ?? [])
    const allBlocked = dimensions.length > 0 && dimensions.every((d) => blocked.has(d))
    // A blocked-only request means the warehouse cannot answer the tab — fall
    // back to dummy. A successful empty page is honest ("no rows in range") and
    // must render the table's empty state, not fabricated rows.
    if (allBlocked) throw new ApiError(200, 'no usable rows')

    const rows: ReportRow[] = results.map(toReportRow)
    return {
      count: data.total_count ?? rows.length,
      results: rows,
      page: data.page ?? q.page ?? 1,
      page_size: data.page_size ?? rows.length,
    }
  } catch {
    return paginate(groupReportRows(dimensions), { page_size: 50, ...q })
  }
}

/**
 * Same contract as queryReport, scoped to one GAM child network code.
 *
 * The code is a path segment the server injects as a filter, so a partner
 * cannot widen the query by editing a browser-supplied filter.
 *
 * Unlike the unscoped variant this does NOT fall back to dummy rows on error —
 * fabricated data on a single-publisher page would be attributed to that
 * publisher. A failure surfaces as a rejected promise and renders ErrorPanel.
 */
export async function queryPublisherReport(
  networkCode: string,
  dimensions: string[],
  q: ListQuery = {},
  range?: DateRange,
): Promise<Page<ReportRow>> {
  const end = range?.to ?? isoDay(new Date())
  const start = range?.from ?? isoDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
  const data = await backendFetch<{
    results?: RawReportRow[]
    total_count?: number
    page?: number
    page_size?: number
    blocked_dimensions?: string[]
  }>(`/api/v1/reports/publishers/${encodeURIComponent(networkCode)}/query/`, {
    method: 'POST',
    body: JSON.stringify({
      date_range: { start, end },
      dimensions,
      metrics: metricsFor(dimensions),
      page: q.page ?? 1,
      page_size: Math.min(q.page_size ?? 50, 500),
    }),
  })

  const rows: ReportRow[] = (data.results ?? []).map(toReportRow)
  return {
    count: data.total_count ?? rows.length,
    results: rows,
    page: data.page ?? q.page ?? 1,
    page_size: data.page_size ?? rows.length,
  }
}

// ---------------------------------------------------------------------------
// Admin single-publisher report (one GAM child network code)
//
// The network code is a path segment, so it is never read from a query filter
// the browser could tamper with.
// ---------------------------------------------------------------------------

export interface PublisherReportSummary {
  revenue: number
  impressions: number
  clicks: number
  ecpm: number
  ctr: number
  fill_rate: number
  ad_requests: number
}

const publisherBase = (networkCode: string) =>
  `/api/v1/reports/publishers/${encodeURIComponent(networkCode)}`

/** Defaults to today when the range is omitted, like the parent view. */
const publisherRange = (range?: DateRange) =>
  range ? `?start=${range.from}&end=${range.to}` : ''

export async function getPublisherReportSummary(
  networkCode: string,
  range?: DateRange,
): Promise<PublisherReportSummary> {
  const data = await backendFetch<PublisherReportSummary>(
    `${publisherBase(networkCode)}/summary/${publisherRange(range)}`,
  )
  return {
    revenue: Number(data.revenue ?? 0),
    impressions: Number(data.impressions ?? 0),
    clicks: Number(data.clicks ?? 0),
    ecpm: Number(data.ecpm ?? 0),
    ctr: Number(data.ctr ?? 0),
    fill_rate: Number(data.fill_rate ?? 0),
    ad_requests: Number(data.ad_requests ?? 0),
  }
}

// ---------------------------------------------------------------------------
// Filter report — quality-signal filters (admin)
// ---------------------------------------------------------------------------

export interface FilterReportRow {
  network_code: string
  site?: string | null
  revenue: number
  applicable_revenue: number
  not_applicable_revenue: number
  na_pct: number
  ios_pct: number
  impressions: number
}

export interface FilterReportResult {
  results: FilterReportRow[]
  total_count: number
  page: number
  page_size: number
}

export interface ReportFilterInput {
  range?: DateRange
  trafficSources?: string[]
  minNotApplicablePct?: number | null
  minIosPct?: number | null
  page?: number
  pageSize?: number
}

export async function filterReport(input: ReportFilterInput = {}): Promise<FilterReportResult> {
  const end = input.range?.to ?? isoDay(new Date())
  const start = input.range?.from ?? isoDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
  const data = await backendFetch<FilterReportResult>('/api/v1/reports/filter/', {
    method: 'POST',
    body: JSON.stringify({
      date_range: { start, end },
      ...(input.trafficSources && input.trafficSources.length > 0
        ? { traffic_sources: input.trafficSources }
        : {}),
      ...(input.minNotApplicablePct != null
        ? { min_not_applicable_pct: input.minNotApplicablePct }
        : {}),
      ...(input.minIosPct != null ? { min_ios_pct: input.minIosPct } : {}),
      page: input.page ?? 1,
      page_size: Math.min(input.pageSize ?? 25, 500),
    }),
  })
  const results = (data.results ?? []).map((r) => ({
    network_code: String(r.network_code ?? ''),
    site: r.site,
    revenue: Number(r.revenue ?? 0),
    applicable_revenue: Number(r.applicable_revenue ?? 0),
    not_applicable_revenue: Number(r.not_applicable_revenue ?? 0),
    na_pct: Number(r.na_pct ?? 0),
    ios_pct: Number(r.ios_pct ?? 0),
    impressions: Number(r.impressions ?? 0),
  }))
  return {
    results,
    total_count: data.total_count ?? results.length,
    page: data.page ?? input.page ?? 1,
    page_size: data.page_size ?? results.length,
  }
}

export interface TrafficSourceOption {
  value: string
  revenue: number
}

export async function trafficSources(range?: DateRange): Promise<TrafficSourceOption[]> {
  const data = await backendFetch<{ results?: TrafficSourceOption[] }>(
    `/api/v1/reports/traffic-sources/${rangeQuery(range)}`,
  )
  return (data.results ?? []).map((r) => ({
    value: String(r.value ?? ''),
    revenue: Number(r.revenue ?? 0),
  }))
}

interface RevenueActivity {
  series?: { date: string; revenue: number }[]
}

export async function trend(
  portal: Portal,
  range?: DateRange,
): Promise<{ label: string; value: number }[]> {
  if (portal === 'admin') {
    try {
      const data = await backendFetch<RevenueActivity>(
        `/api/v1/reports/ma-dashboard/revenue-activity/${rangeQuery(range)}`,
      )
      const series = data.series ?? []
      if (series.length) return series.map((p) => ({ label: shortDate(p.date), value: p.revenue }))
    } catch {
      // fall through to the dummy trend
    }
    return resolve(revenueTrend)
  }
  return resolve(partnerTrend)
}

interface RecentActivityRow {
  action?: string
  message?: string | null
  occurred_at?: string
}

function activityKind(action: string): string {
  const a = action.toUpperCase()
  if (a.includes('ALERT') || a.includes('POLICY') || a.includes('IVT')) return 'alert'
  if (a.includes('PAYMENT') || a.includes('STATEMENT')) return 'payment'
  if (a.includes('INVITE') || a.includes('PUBLISHER')) return 'invite'
  if (a.includes('MCM')) return 'mcm'
  return 'system'
}

export async function activity(): Promise<{ text: string; time: string; kind: string }[]> {
  try {
    const data = await backendFetch<{ results?: RecentActivityRow[] }>(
      '/api/v1/reports/ma-dashboard/recent-activity/',
    )
    const rows = (data.results ?? []).slice(0, 6).map((r) => ({
      text: r.message || r.action || 'Activity recorded',
      time: formatTimestamp(r.occurred_at),
      kind: activityKind(r.action ?? ''),
    }))
    if (rows.length) return rows
  } catch {
    // fall through to the dummy feed
  }
  return resolve(activityFeed)
}

/* --------------------------------- Finance -------------------------------- */

export function listRevenueRecords(q: ListQuery = {}): Promise<Page<RevenueRecord>> {
  // Backend revenue_records table is not provisioned in BigQuery yet.
  const rows = revenueRecords.filter((r) => match(q.search, r.site, r.partner_name, r.partner_ticket))
  return resolve(paginate(rows, q))
}

export function listStatements(q: ListQuery = {}): Promise<Page<Statement>> {
  // Backend statements table is not provisioned in BigQuery yet.
  const rows = statements.filter(
    (s) => match(q.search, s.partner_name, s.partner_ticket, s.id) && (!q.status || s.status === q.status),
  )
  return resolve(paginate(rows, q))
}

export function listPayments(q: ListQuery = {}): Promise<Page<Payment>> {
  // Backend payments table is not provisioned in BigQuery yet.
  const rows = payments.filter(
    (p) => match(q.search, p.partner_name, p.partner_ticket, p.reference) && (!q.status || p.status === q.status),
  )
  return resolve(paginate(rows, q))
}

export function listCsvImports(): Promise<Page<CsvImport>> {
  // CSV import listing endpoint is POST-only for now.
  return resolve(paginate(csvImports))
}

/* ---------------------------------- MCM ----------------------------------- */

interface RawProvider {
  mcm_provider_id: string
  provider_type: string
  name: string
  capabilities_json?: Record<string, boolean> | null
  status?: string | null
}

interface RawMcmRel {
  mcm_relationship_id: string
  mcm_connection_id?: string | null
  network_code?: string | null
  label?: string | null
  network_name?: string | null
  invitation_status?: string | null
  api_status?: string | null
  last_successful_sync_at?: string | null
  last_attempted_sync_at?: string | null
}

function mapInviteState(status?: string | null): McmRelationship['invite_state'] {
  if (!status) return 'Not sent'
  const s = status.toUpperCase()
  if (s === 'SENT') return 'Sent'
  if (s === 'ACCEPTED') return 'Accepted'
  if (s === 'DECLINED') return 'Declined'
  if (s === 'EXPIRED') return 'Expired'
  if (s === 'WITHDRAWN') return 'Withdrawn'
  if (s === 'PENDING' || s === 'INVITED') return 'Sent'
  return 'Not sent'
}

function mapMcmRelationship(raw: RawMcmRel): McmRelationship {
  return {
    id: raw.mcm_relationship_id,
    site: raw.label || raw.network_name || '',
    partner_ticket: '',
    mcm_id: raw.mcm_connection_id ?? '',
    network_code: raw.network_code ?? '',
    invite_state: mapInviteState(raw.invitation_status),
    api_status: (raw.api_status ?? 'OK') as McmRelationship['api_status'],
    last_sync: raw.last_successful_sync_at ?? '',
    status_history: [],
  }
}

const REL_PAGE_SIZE = 200
const REL_MAX_PAGES = 10
let relCache: { at: number; rows: RawMcmRel[] } | null = null

async function fetchAllMcmRelationships(): Promise<RawMcmRel[]> {
  if (relCache && Date.now() - relCache.at < 30_000) return relCache.rows
  const rows: RawMcmRel[] = []
  for (let page = 1; page <= REL_MAX_PAGES; page++) {
    const data = await backendFetch<BackendList<RawMcmRel>>(
      '/api/v1/mcm/relationships/' + search({ page, page_size: REL_PAGE_SIZE }),
    )
    const chunk = data.results ?? []
    rows.push(...chunk)
    if (chunk.length < REL_PAGE_SIZE) break
  }
  relCache = { at: Date.now(), rows }
  return rows
}

function latestSync(rows: RawMcmRel[], field: 'last_successful_sync_at' | 'last_attempted_sync_at'): string {
  let latest = ''
  for (const row of rows) {
    const value = row[field]
    if (value && value > latest) latest = value
  }
  return latest
}

export async function listMcmConnections() {
  try {
    const [providers, relationships] = await Promise.all([
      backendFetch<BackendList<RawProvider>>('/api/v1/mcm/providers/' + search({ page_size: 200 })),
      fetchAllMcmRelationships(),
    ])
    const rows = (providers.results ?? []).map((p) => ({
      mcm_id: p.mcm_provider_id,
      mcm_name: p.name,
      provider_type: p.provider_type,
      account_reference: '',
      status: p.status === 'ACTIVE' ? ('Active' as const) : p.status === 'DISABLED' ? ('Disabled' as const) : ('Error' as const),
      default_flag: true,
      priority: 1,
      capabilities: Object.keys(p.capabilities_json ?? {}),
      last_success_sync: latestSync(relationships, 'last_successful_sync_at'),
      last_attempted_sync: latestSync(relationships, 'last_attempted_sync_at'),
      last_error: null,
      relationships: relationships.filter((r) => r.mcm_connection_id === p.mcm_provider_id).length,
      health: 'Healthy' as const,
    }))
    if (rows.length) return rows
  } catch {
    // fall through to the dummy connections
  }
  return resolve(mcmConnections)
}

export async function listMcmRelationships(q: ListQuery = {}) {
  try {
    const rows = (await fetchAllMcmRelationships()).map(mapMcmRelationship)
    const filtered = rows.filter((r) => match(q.search, r.site, r.partner_ticket, r.network_code))
    return paginate(filtered, q)
  } catch {
    const rows = mcmRelationships.filter((r) => match(q.search, r.site, r.partner_ticket, r.network_code))
    return paginate(rows, q)
  }
}

export const mcmAdapterContract = () => resolve(integrationContract)
export const mcmInviteLog = () => resolve(inviteLog)

/* -------------------------------- Policies -------------------------------- */

export function listPolicyIssues(q: ListQuery = {}): Promise<Page<PolicyIssue>> {
  // Backend policy_issues table is not provisioned in BigQuery yet.
  const rows = policyIssues.filter(
    (i) => match(q.search, i.site, i.partner_ticket) &&
      (!q.status || i.status === q.status) &&
      (!q.page_size || true),
  )
  return resolve(paginate(rows, q))
}

/* ------------------------------ Notifications ----------------------------- */

export function listNotifications(portal: Portal): Promise<AppNotification[]> {
  // Backend notifications table is not provisioned in BigQuery yet.
  return resolve(
    notifications.filter((n) => n.scope === 'both' || n.scope === portal),
    150,
  )
}

/* --------------------------- Smart notifications -------------------------- */
//
// BigQuery `notifications`, served by apps.notifications.NotificationViewSet.
// The recipient is resolved server-side from the session, so the browser never
// supplies the user it is reading for.

/**
 * The list endpoint returns the full row (the `SELECT *` in the repository),
 * not the reduced `NotificationListSerializer` shape, so `message`,
 * `partner_id` and the reference fields are present.
 */
export async function listSmartNotifications(opts: {
  isRead?: boolean
  page?: number
  pageSize?: number
} = {}): Promise<Page<SmartNotification>> {
  const data = await backendFetch<{
    count?: number
    results?: RawNotification[]
    page?: number
    page_size?: number
  }>(
    '/api/v1/notifications/' +
      search({
        is_read: opts.isRead === undefined ? undefined : String(opts.isRead),
        page: opts.page ?? 1,
        page_size: Math.min(opts.pageSize ?? 25, 200),
      }),
  )

  const rows: SmartNotification[] = (data.results ?? []).map((r) => ({
    notification_id: String(r.notification_id ?? ''),
    recipient_user_id: String(r.recipient_user_id ?? ''),
    partner_id: String(r.partner_id ?? ''),
    notification_type: String(r.notification_type ?? 'system'),
    title: String(r.title ?? ''),
    message: String(r.message ?? ''),
    severity: String(r.severity ?? 'INFO'),
    is_read: Boolean(r.is_read),
    reference_type: String(r.reference_type ?? ''),
    reference_id: String(r.reference_id ?? ''),
    created_at: String(r.created_at ?? ''),
  }))

  return {
    count: data.count ?? rows.length,
    results: rows,
    page: data.page ?? opts.page ?? 1,
    page_size: data.page_size ?? rows.length,
  }
}

/** Marks one notification read. Scoped to the caller's own rows server-side. */
export async function markSmartNotificationRead(
  notificationId: string,
): Promise<{ status: string; notification_id: string }> {
  return backendFetch(
    `/api/v1/notifications/${encodeURIComponent(notificationId)}/mark_read/`,
    { method: 'POST' },
  )
}

/** Marks every unread notification for the caller as read. */
export async function markAllSmartNotificationsRead(): Promise<{ status: string }> {
  return backendFetch('/api/v1/notifications/mark_all_read/', { method: 'POST' })
}

/* --------------------------------- Audit ---------------------------------- */

interface RawAudit {
  audit_id: string
  occurred_at: string
  actor_role_key?: string | null
  actor_partner_id?: string | null
  object_type?: string | null
  object_id?: string | null
  action: string
  previous_state_json?: unknown
  new_state_json?: unknown
  reason?: string | null
}

function stateText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function mapAudit(raw: RawAudit): AuditEvent {
  return {
    id: raw.audit_id,
    action: raw.action,
    actor: raw.actor_role_key ?? 'system',
    actor_role: raw.actor_role_key ?? '',
    target_type: raw.object_type ?? '',
    target_id: raw.object_id ?? '',
    description: raw.reason || raw.action,
    previous_state: stateText(raw.previous_state_json),
    new_state: stateText(raw.new_state_json),
    partner_ticket: null,
    timestamp: raw.occurred_at,
  }
}

export async function listAudit(q: ListQuery = {}): Promise<Page<AuditEvent>> {
  try {
    const data = await backendFetch<BackendList<RawAudit>>(
      '/api/v1/audit/' + search({ page: q.page ?? 1, page_size: 200 }),
    )
    const rows = (data.results ?? []).map(mapAudit)
    const filtered = rows.filter(
      (a) => match(q.search, a.action, a.actor, a.description, a.target_id) &&
        (!q.status || a.action === q.status),
    )
    return paginate(filtered, { ...q, page_size: filtered.length || 1 })
  } catch {
    const rows = auditLog.filter(
      (a) => match(q.search, a.action, a.actor, a.description, a.target_id) &&
        (!q.status || a.action === q.status),
    )
    return paginate(rows, q)
  }
}

/* --------------------------------- Health --------------------------------- */

export async function getHealth(): Promise<HealthCheck[]> {
  try {
    const [probe, system] = await Promise.all([
      backendFetch<{ status?: string; components?: Record<string, string> }>('/api/v1/health/'),
      backendFetch<SystemHealth>('/api/v1/health/system/'),
    ])
    const now = new Date().toISOString()
    const bigQueryOk = probe.components?.bigquery === 'ok'
    return [
      {
        area: 'BigQuery',
        status: bigQueryOk ? 'Healthy' : 'Down',
        detail: bigQueryOk ? 'Application dataset reachable' : 'BigQuery probe is failing',
        metric: probe.status ?? '',
        checked_at: now,
      },
      {
        area: 'Partners',
        status: 'Healthy',
        detail: `${system.total_partners ?? 0} total · ${system.active_partners ?? 0} active`,
        metric: `${system.active_partners ?? 0} active`,
        checked_at: now,
      },
      {
        area: 'Sites',
        status: 'Healthy',
        detail:
          `${system.total_sites ?? 0} total · ${system.active_sites ?? 0} active · ` +
          `${system.invited_sites ?? 0} invited · ${system.pending_sites ?? 0} pending`,
        metric: `${system.active_sites ?? 0} active`,
        checked_at: now,
      },
      {
        area: 'MCM',
        status: 'Healthy',
        detail: system.mcm_last_sync
          ? `Last sync ${formatTimestamp(system.mcm_last_sync)}`
          : 'No sync recorded yet',
        metric: system.mcm_last_sync ? 'synced' : 'idle',
        checked_at: now,
      },
    ]
  } catch {
    return resolve(healthChecks, 200)
  }
}

/* --------------------------------- Support -------------------------------- */

/** One row of GET /api/v1/support/tickets/ — the cross-partner support queue. */
export interface SupportTicketRow {
  ticket_id: string
  partner_tag: string
  subject: string
  category: string
  priority: string
  status: string
  assigned_to: string | null
  created_by_name: string | null
  created_by_email: string | null
  created_at: string | null
  updated_at: string | null
  resolved_at: string | null
  last_message_at: string | null
  message_count: number
}

/** Global tab counts — never affected by search or the selected status. */
export interface SupportTicketCounts {
  total: number
  active: number
  open: number
  in_progress: number
  waiting: number
  resolved: number
  closed: number
}

export interface SupportTicketsPage {
  results: SupportTicketRow[]
  total_count: number
  page: number
  page_size: number
  counts: SupportTicketCounts
}

export interface SupportTicketMessage {
  message_id: string
  ticket_id: string
  sender_type: string
  sender_name: string | null
  sender_email: string | null
  body: string
  created_at: string | null
}

export interface SupportTicketDetail {
  ticket: (SupportTicketRow & { description: string }) | null
  messages: SupportTicketMessage[]
}

export interface SupportTicketInput {
  partner_tag: string
  subject: string
  description: string
  category: string
  priority: string
}

/** Admin queue: every partner tag, server-side filter + pagination. */
export async function listSupportTickets(
  q: ListQuery & { category?: string } = {},
): Promise<SupportTicketsPage> {
  return backendFetch<SupportTicketsPage>(
    '/api/v1/support/tickets/' +
      search({
        search: q.search,
        status: q.status && q.status !== 'all' ? q.status : undefined,
        category: q.category && q.category !== 'all' ? q.category : undefined,
        page: q.page ?? 1,
        page_size: q.page_size ?? 20,
      }),
  )
}

export const getSupportTicket = (ticketId: string) =>
  backendFetch<SupportTicketDetail>(
    `/api/v1/support/tickets/${encodeURIComponent(ticketId)}/`,
  )

export const createSupportTicket = (input: SupportTicketInput) =>
  backendFetch<{ ticket_id: string }>('/api/v1/support/tickets/', {
    method: 'POST',
    body: JSON.stringify(input),
  })
