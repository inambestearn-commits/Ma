'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '@/lib/api'
import type { ListQuery } from '@/lib/api'
import type { DateRange } from '@/lib/date'
import type { Portal } from '@/lib/data/types'

export const qk = {
  dashboard: (portal: Portal, range?: DateRange) => ['dashboard', portal, range?.from, range?.to] as const,
  trend: (portal: Portal, range?: DateRange) => ['trend', portal, range?.from, range?.to] as const,
  activity: () => ['activity'] as const,
  partners: (q: ListQuery) => ['partners', q] as const,
  partner: (id: string) => ['partner', id] as const,
  partnerUsers: (ticket?: string) => ['partner-users', ticket] as const,
  sites: (q: ListQuery) => ['sites', q] as const,
  managePublishers: (q: ListQuery) => ['manage-publishers', q] as const,
  rules: (scope?: string, q?: ListQuery) => ['rules', scope, q] as const,
  alerts: (q: ListQuery) => ['alerts', q] as const,
  autoActions: () => ['auto-actions'] as const,
  report: (dims: string[], q?: ListQuery, range?: DateRange) =>
    ['report', dims, q, range?.from, range?.to] as const,
  revenue: (q: ListQuery) => ['revenue', q] as const,
  statements: (q: ListQuery) => ['statements', q] as const,
  payments: (q: ListQuery) => ['payments', q] as const,
  csv: () => ['csv-imports'] as const,
  mcm: () => ['mcm-connections'] as const,
  mcmRel: (q: ListQuery) => ['mcm-relationships', q] as const,
  mcmLog: () => ['mcm-log'] as const,
  policies: (q: ListQuery) => ['policies', q] as const,
  notifications: (portal: Portal) => ['notifications', portal] as const,
  smartNotifications: (isRead?: boolean, page = 1, pageSize = 25) =>
    ['smart-notifications', isRead, page, pageSize] as const,
  audit: (q: ListQuery) => ['audit', q] as const,
  health: () => ['health'] as const,
  support: (q: object = {}) => ['support', q] as const,
  supportTicket: (id: string) => ['support-ticket', id] as const,
  // Single-publisher (one GAM child network code) admin report.
  publisherReportSummary: (networkCode: string, range?: DateRange) =>
    ['publisher-report-summary', networkCode, range?.from, range?.to] as const,
  publisherReport: (networkCode: string, dims: string[], q?: ListQuery, range?: DateRange) =>
    ['publisher-report', networkCode, dims, q, range?.from, range?.to] as const,
  // Filter report — quality-signal filters + traffic-source options.
  reportFilter: (input: object) => ['report-filter', input] as const,
  trafficSources: (range?: DateRange) => ['traffic-sources', range?.from, range?.to] as const,
}

export const useDashboard = (portal: Portal, range?: DateRange) =>
  useQuery({ queryKey: qk.dashboard(portal, range), queryFn: () => api.getDashboard(portal, range) })

export const useTrend = (portal: Portal, range?: DateRange) =>
  useQuery({ queryKey: qk.trend(portal, range), queryFn: () => api.trend(portal, range) })

export const useActivity = () =>
  useQuery({ queryKey: qk.activity(), queryFn: api.activity })

export const usePartners = (q: ListQuery = {}) =>
  useQuery({ queryKey: qk.partners(q), queryFn: () => api.listPartners(q) })

export const usePartner = (id: string) =>
  useQuery({ queryKey: qk.partner(id), queryFn: () => api.getPartner(id), enabled: !!id })

export const usePartnerUsers = (ticket?: string) =>
  useQuery({ queryKey: qk.partnerUsers(ticket), queryFn: () => api.listPartnerUsers(ticket) })

export const useSites = (q: ListQuery = {}) =>
  useQuery({ queryKey: qk.sites(q), queryFn: () => api.listSites(q) })

export const useManagePublishers = (q: ListQuery = {}) =>
  useQuery({
    queryKey: qk.managePublishers(q),
    queryFn: () => api.listManagePublishers(q),
    placeholderData: (prev) => prev,
  })

export const useRules = (scope?: 'global' | 'partner' | 'site', q: ListQuery = {}) =>
  useQuery({ queryKey: qk.rules(scope, q), queryFn: () => api.listRules(scope, q) })

export const useAlerts = (q: ListQuery = {}) =>
  useQuery({ queryKey: qk.alerts(q), queryFn: () => api.listAlerts(q) })

export const useAutoActions = () =>
  useQuery({ queryKey: qk.autoActions(), queryFn: api.autoActionList })

export const useReport = (dimensions: string[], q: ListQuery = {}, range?: DateRange) =>
  useQuery({
    queryKey: qk.report(dimensions, q, range),
    queryFn: () => api.queryReport(dimensions, q, range),
  })

export const usePublisherReportSummary = (networkCode: string, range?: DateRange) =>
  useQuery({
    queryKey: qk.publisherReportSummary(networkCode, range),
    queryFn: () => api.getPublisherReportSummary(networkCode, range),
    enabled: !!networkCode,
  })

/** Same as useReport, scoped to a single GAM child network code. */
export const usePublisherReport = (
  networkCode: string,
  dimensions: string[],
  q: ListQuery = {},
  range?: DateRange,
) =>
  useQuery({
    queryKey: qk.publisherReport(networkCode, dimensions, q, range),
    queryFn: () => api.queryPublisherReport(networkCode, dimensions, q, range),
    enabled: !!networkCode,
    // No placeholderData: the drill-down swaps dimensions in place, and
    // carrying the previous dimension's rows across the key change hides the
    // loading state — the table looks like stale dummy data until the new
    // aggregate lands. Resetting to undefined makes isLoading true instead.
  })

export const useReportFilter = (input: api.ReportFilterInput) =>
  useQuery({
    queryKey: qk.reportFilter(input),
    queryFn: () => api.filterReport(input),
    placeholderData: (prev) => prev,
  })

export const useTrafficSources = (range?: DateRange) =>
  useQuery({
    queryKey: qk.trafficSources(range),
    queryFn: () => api.trafficSources(range),
  })

export const useRevenueRecords = (q: ListQuery = {}) =>
  useQuery({ queryKey: qk.revenue(q), queryFn: () => api.listRevenueRecords(q) })

export const useStatements = (q: ListQuery = {}) =>
  useQuery({ queryKey: qk.statements(q), queryFn: () => api.listStatements(q) })

export const usePayments = (q: ListQuery = {}) =>
  useQuery({ queryKey: qk.payments(q), queryFn: () => api.listPayments(q) })

export const useCsvImports = () =>
  useQuery({ queryKey: qk.csv(), queryFn: api.listCsvImports })

export const useMcmConnections = () =>
  useQuery({ queryKey: qk.mcm(), queryFn: api.listMcmConnections })

export const useMcmRelationships = (q: ListQuery = {}) =>
  useQuery({ queryKey: qk.mcmRel(q), queryFn: () => api.listMcmRelationships(q) })

export const useMcmLog = () =>
  useQuery({ queryKey: qk.mcmLog(), queryFn: api.mcmInviteLog })

export const usePolicyIssues = (q: ListQuery = {}) =>
  useQuery({ queryKey: qk.policies(q), queryFn: () => api.listPolicyIssues(q) })

export const useNotifications = (portal: Portal) =>
  useQuery({ queryKey: qk.notifications(portal), queryFn: () => api.listNotifications(portal) })

/**
 * Smart notifications from BigQuery, scoped to the signed-in user by the
 * server. Both mutations invalidate every list key rather than just the
 * current page, so a mark-read on page 1 still updates the unread count the
 * filter row is showing.
 */
export const useSmartNotifications = (isRead?: boolean, page = 1, pageSize = 25) =>
  useQuery({
    queryKey: qk.smartNotifications(isRead, page, pageSize),
    queryFn: () => api.listSmartNotifications({ isRead, page, pageSize }),
    placeholderData: (prev) => prev,
  })

export const useMarkNotificationRead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.markSmartNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['smart-notifications'] }),
  })
}

export const useMarkAllNotificationsRead = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.markAllSmartNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['smart-notifications'] }),
  })
}

/**
 * Admin listing of every partner publisher-submission request.
 * Served by /api/admin/submissions (session must carry a GLOBAL admin role).
 */
export const useAdminSubmissions = () =>
  useQuery({
    queryKey: ['admin-submissions'],
    queryFn: async () => {
      const res = await fetch('/api/admin/submissions', { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `Request failed (${res.status})`)
      }
      return res.json() as Promise<{ requests: import('@/lib/data/types').AdminSubmission[] }>
    },
    placeholderData: (prev) => prev,
  })

export const useAudit = (q: ListQuery = {}) =>
  useQuery({ queryKey: qk.audit(q), queryFn: () => api.listAudit(q) })

export const useHealth = () =>
  useQuery({ queryKey: qk.health(), queryFn: api.getHealth })

export const useSupportTickets = (q: ListQuery & { category?: string } = {}) =>
  useQuery({
    queryKey: qk.support(q),
    queryFn: () => api.listSupportTickets(q),
    placeholderData: (prev) => prev,
  })

export const useSupportTicket = (ticketId: string | null) =>
  useQuery({
    queryKey: qk.supportTicket(ticketId ?? ''),
    queryFn: () => api.getSupportTicket(ticketId as string),
    enabled: !!ticketId,
  })
