'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

/**
 * Client hooks for the partner API routes.
 *
 * The partner tag is never sent from here — the route handlers read it from
 * the session cookie. That is deliberate: if the tag travelled in the request,
 * any signed-in partner could ask for another partner's data.
 */

export interface PartnerSummary {
  partner: { tag: string; email: string; fullName: string | null }
  /** The window every figure below was computed over. */
  range: {
    from: string
    to: string
    isSingleDay: boolean
    isToday: boolean
    sitesEarning: number
    sitesWithData: number
  }
  sites: { total: number; active: number; invited: number; inactive: number; declined: number }
  performance: {
    revenue: number
    impressions: number
    clicks: number
    ecpm: number
    ctr: number
  }
  /**
   * Applicable vs not-applicable revenue, and the iOS impression share.
   *
   * Both are recomputed from the daily rows for the selected window rather
   * than read from the bot's once-a-day snapshot, which has no per-row date
   * and goes stale when the daily table is restated. So the split answers any
   * window, and applicable + not-applicable always equals the revenue shown
   * beside it.
   *
   * `available` is false only when the window holds no daily rows at all.
   *
   * The iOS figure is an IMPRESSION share, not a revenue share — adx_os_stats
   * has no revenue column, so no such number can exist at any date.
   */
  split: {
    available: boolean
    applicableRevenue: number
    notApplicableRevenue: number
    iosImpressionSharePct: number
    iosImpressionShareAvailable: boolean
  }
  /**
   * What the parent keeps from the window's revenue: each site's revenue times
   * the share recorded on its network_codes row, summed. A site with no share
   * on record contributes nothing.
   */
  grossParentTotal: number
  /**
   * Fill rate over the window from `adx_fill_stats`, weighted by ad_requests
   * and expressed as a percent (e.g. 86.4). Zero when the window holds no
   * fill rows — check `fillRateAvailable` before rendering it as a real rate.
   */
  fillRate: number
  fillRateAvailable: boolean
  trend: {
    points: { date: string | null; revenue: number; impressions: number; clicks: number }[]
    hasHistory: boolean
  }
  topSites: {
    label: string
    domain: string
    networkCode: string
    accountStatus: string
    revenue: number
    impressions: number
    clicks: number
  }[]
  meta: { lastSyncedAt: string | null; bytesScanned: number }
}

export interface PartnerSite {
  networkCode: string
  label: string
  domain: string
  accountStatus: string | null
  invitationStatus: string | null
  approvalStatus: string | null
  delegationType: string | null
  revenueSharePct: number | null
  email: string | null
  childPublisherId: string | null
  revenue: number
  impressions: number
  clicks: number
  ecpm: number
  hasStats: boolean
}

export interface PartnerSitesResponse {
  count: number
  page: number
  page_size: number
  /** Which column the tab counts were computed from. */
  facet: 'account' | 'invitation'
  /** `total` plus one key per facet bucket, lowercased (e.g. `accepted`, `active`). */
  counts: Record<string, number>
  results: PartnerSite[]
}

/** One row of a reporting dimension. Only the fields that dimension defines are present. */
export interface PartnerReportRow {
  site?: string
  label?: string
  network_code?: string
  account_status?: string | null
  traffic_source?: string
  traffic_source_count?: number
  device?: string
  country?: string
  carrier?: string
  browser?: string
  impressions: number
  clicks: number
  revenue: number
  ecpm: number
  ctr: number
}

export interface PartnerReporting {
  dimension: string
  count: number
  page: number
  page_size: number
  results: PartnerReportRow[]
  dates: string[]
  hasHistory: boolean
  range: { from: string; to: string; isToday: boolean }
  totals: {
    revenue: number
    impressions: number
    clicks: number
    ecpm: number
    ctr: number
    totalSites: number
    sitesWithData: number
    sitesEarning: number
    applicableRevenue: number
    notApplicableRevenue: number
    /**
     * Recomputed from the daily rows for the selected window, so it follows
     * the date filter and always sums to the revenue above. False only when
     * the window holds no daily rows at all.
     */
    applicableAvailable: boolean
    /** Derived per-range from adx_os_stats — follows the date filter. */
    iosSharePct: number
    iosShareAvailable: boolean
    /**
     * The single day the applicable split describes. It is written once a day
     * with no per-row date, so it answers only that day — not the calendar
     * today, and not any wider window.
     */
    snapshotDate: string | null
  }
  meta: {
    lastSyncedAt: string | null
    firstDataDate: string | null
    lastDataDate: string | null
    bytesScanned: number
  }
}

export interface PartnerEarningsRow {
  month: string
  childNetworkCode: string
  childName: string | null
  delegationType: string | null
  totalEarnings: number
  currency: string
  parentPayment: number
  childPayment: number
  deductions: number
  updatedAt: string | null
}

export interface PartnerTopSite {
  label: string
  domain: string
  networkCode: string
  accountStatus: string | null
  weekRevenue: number
  weekImpressions: number
  weekApplicable: number
  weekNotApplicable: number
}

export interface PartnerPayments {
  partner: { tag: string }
  earnings: PartnerEarningsRow[]
  performance: {
    totalSites: number
    sitesWithData: number
    sitesEarning: number
    today: { revenue: number; impressions: number; clicks: number; applicable: number; notApplicable: number }
    week: {
      revenue: number
      impressions: number
      clicks: number
      applicable: number
      notApplicable: number
      iosSharePct: number
    }
  }
  topSites: PartnerTopSite[]
  meta: { lastSyncedAt: string | null; firstDataDate: string | null; bytesScanned: number }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `Request failed (${res.status})`)
  }
  return res.json()
}

export const partnerKeys = {
  summary: (range: { from: string; to: string }) => ['partner', 'summary', range] as const,
  sites: (params: Record<string, unknown>) => ['partner', 'sites', params] as const,
  reporting: (params: Record<string, unknown>) => ['partner', 'reporting', params] as const,
  payments: () => ['partner', 'payments'] as const,
}

export const usePartnerSummary = (range: { from: string; to: string }) =>
  useQuery({
    queryKey: partnerKeys.summary(range),
    queryFn: () => {
      const qs = new URLSearchParams({ from: range.from, to: range.to })
      return getJson<PartnerSummary>(`/api/p/summary?${qs.toString()}`)
    },
  })

export const usePartnerSites = (params: { search: string; status: string; page: number; facet?: 'account' | 'invitation' }) =>
  useQuery({
    queryKey: partnerKeys.sites(params),
    queryFn: () => {
      const qs = new URLSearchParams()
      if (params.search) qs.set('search', params.search)
      if (params.status && params.status !== 'all') qs.set('status', params.status)
      if (params.facet) qs.set('facet', params.facet)
      qs.set('page', String(params.page))
      qs.set('page_size', '25')
      return getJson<PartnerSitesResponse>(`/api/p/sites?${qs.toString()}`)
    },
    placeholderData: (prev) => prev,
  })

export const usePartnerReporting = (params: { dimension: string; page: number; from: string; to: string }) =>
  useQuery({
    queryKey: partnerKeys.reporting(params),
    queryFn: () => {
      const qs = new URLSearchParams({
        dimension: params.dimension,
        page: String(params.page),
        page_size: '8',
        from: params.from,
        to: params.to,
      })
      return getJson<PartnerReporting>(`/api/p/reporting?${qs.toString()}`)
    },
    placeholderData: (prev) => prev,
  })

export const usePartnerPayments = () =>
  useQuery({ queryKey: partnerKeys.payments(), queryFn: () => getJson<PartnerPayments>('/api/p/payments') })

/* ------------------------------- Support tickets ------------------------------ */

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? `Request failed (${res.status})`)
  }
  return res.json()
}

export interface PartnerTicket {
  ticketId: string
  subject: string
  description: string
  category: string
  priority: string
  status: string
  assignedTo: string | null
  createdBy: { userId: string | null; name: string | null; email: string | null }
  createdAt: string | null
  updatedAt: string | null
  resolvedAt: string | null
  lastMessageAt: string | null
  messageCount: number
}

export interface PartnerTicketMessage {
  messageId: string
  ticketId: string
  senderType: 'PARTNER' | 'SUPPORT'
  senderName: string | null
  senderEmail: string | null
  body: string
  createdAt: string | null
}

export interface PartnerTicketHistoryEntry {
  historyId: string
  action: string
  field: string | null
  fromValue: string | null
  toValue: string | null
  actorType: 'PARTNER' | 'SUPPORT' | 'SYSTEM'
  actorName: string | null
  createdAt: string | null
}

export interface PartnerTicketsResponse {
  count: number
  page: number
  page_size: number
  counts: {
    total: number
    active: number
    open: number
    inProgress: number
    waiting: number
    resolved: number
    closed: number
  }
  results: PartnerTicket[]
  meta: { bytesScanned: number; partnerTag: string }
}

export interface PartnerTicketDetail {
  ticket: PartnerTicket
  messages: PartnerTicketMessage[]
  history: PartnerTicketHistoryEntry[]
}

export const partnerTicketKeys = {
  list: (params: Record<string, unknown>) => ['partner', 'tickets', params] as const,
  detail: (id: string) => ['partner', 'ticket', id] as const,
}

export const usePartnerTickets = (params: {
  search: string
  status: string
  category: string
  page: number
}) =>
  useQuery({
    queryKey: partnerTicketKeys.list(params),
    queryFn: () => {
      const qs = new URLSearchParams()
      if (params.search) qs.set('search', params.search)
      if (params.status && params.status !== 'all') qs.set('status', params.status)
      if (params.category && params.category !== 'all') qs.set('category', params.category)
      qs.set('page', String(params.page))
      qs.set('page_size', '20')
      return getJson<PartnerTicketsResponse>(`/api/p/tickets?${qs.toString()}`)
    },
    placeholderData: (prev) => prev,
  })

export const usePartnerTicket = (id: string) =>
  useQuery({
    queryKey: partnerTicketKeys.detail(id),
    queryFn: () => getJson<PartnerTicketDetail>(`/api/p/tickets/${encodeURIComponent(id)}`),
    enabled: Boolean(id),
  })

export const useCreateTicket = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { subject: string; description: string; category: string; priority: string }) =>
      postJson<{ ticketId: string }>('/api/p/tickets', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partner', 'tickets'] })
    },
  })
}

export const useReplyTicket = (ticketId: string) => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: string) =>
      postJson<{ ok: boolean; reopened: boolean }>(
        `/api/p/tickets/${encodeURIComponent(ticketId)}/messages`,
        { body },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: partnerTicketKeys.detail(ticketId) })
      qc.invalidateQueries({ queryKey: ['partner', 'tickets'] })
    },
  })
}

/* ---------------------------- publisher submissions ---------------------------- */

/**
 * A blocked duplicate is stored as `status: 'unread'` — the partner was told to
 * contact the admin, so this record is the only trace the attempt ever
 * happened. It is deliberately not filtered out of the partner's own list.
 */
export interface PartnerSubmission {
  requestId: string
  site: string
  childName: string
  gamEmail: string
  networkCode: string
  revenueShareMillipercent: number
  delegationType: string
  note: string | null
  status: 'unread' | 'submitted' | 'failed' | string
  reason: string | null
  existingPartnerTag: string | null
  existingLabel: string | null
  gamInvitationStatus: string | null
  errorMessage: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface PartnerSubmissionsResponse {
  partnerTag: string
  requests: PartnerSubmission[]
}

export const partnerSubmissionKeys = {
  list: () => ['partner', 'submissions'] as const,
}

export const usePartnerSubmissions = () =>
  useQuery({
    queryKey: partnerSubmissionKeys.list(),
    queryFn: () => getJson<PartnerSubmissionsResponse>('/api/p/publishers/requests'),
  })

/* ------------------------------- Sub-partners ------------------------------ */

export interface SubPartner {
  subPartnerId: string
  parentTag: string
  parentTicket: string
  subTicket: string
  subTag: string
  name: string
  email: string
  revenueShare: number
  status: string
  authUserId: string | null
  createdAt: string | null
}

export interface SubPartnersResponse {
  subPartners: SubPartner[]
}

export interface CreateSubPartnerInput {
  name: string
  email: string
  password: string
  revenueShare: number
}

export const subPartnerKeys = {
  list: () => ['partner', 'sub-partners'] as const,
}

export const useSubPartners = () =>
  useQuery({
    queryKey: subPartnerKeys.list(),
    queryFn: () => getJson<SubPartnersResponse>('/api/p/sub-partners'),
  })

export const useCreateSubPartner = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSubPartnerInput) =>
      postJson<SubPartner>('/api/p/sub-partners', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: subPartnerKeys.list() }),
  })
}
