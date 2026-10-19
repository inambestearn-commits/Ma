import type { AppNotification, AuditEvent, HealthCheck, PolicyIssue, ReportRow, SupportTicket } from './types'
import type { DashboardSummary } from './types'

export const policyIssues: PolicyIssue[] = [
  { id: 'pol_01', site: 'coastalwire.news', partner_ticket: 'AGX-1005', severity: 'critical', detected_at: '2026-10-05T04:12:00Z', evidence: 'IVT 4.82% over 24h (threshold 1%) — rule sr_01', status: 'Open', publisher_email: 'publisher@gmail.com', notifications: 3 },
  { id: 'pol_02', site: 'bloomcommerce.io', partner_ticket: 'AGX-1003', severity: 'critical', detected_at: '2026-10-04T21:47:00Z', evidence: 'MCM sync stale 7h10m — rule gr_05', status: 'In review', publisher_email: 'publisher@gmail.com', notifications: 2 },
  { id: 'pol_03', site: 'bloomdeals.shop', partner_ticket: 'AGX-1003', severity: 'warning', detected_at: '2026-10-03T11:18:00Z', evidence: 'Incentive traffic source 6.4% — rule pr_02', status: 'In review', publisher_email: 'publisher@gmail.com', notifications: 1 },
  { id: 'pol_04', site: 'signalhouse.media', partner_ticket: 'AGX-1004', severity: 'warning', detected_at: '2026-10-04T15:31:00Z', evidence: 'Auto-refresh traffic 2.1% — rule sr_02', status: 'Resolved', publisher_email: 'publisher@gmail.com', notifications: 2, resolution_notes: 'Partner excluded the source; re-check clean at 2026-10-04 19:00.' },
  { id: 'pol_05', site: 'coastalreport.com', partner_ticket: 'AGX-1005', severity: 'critical', detected_at: '2026-10-01T19:47:00Z', evidence: 'IVT 3.40% over 24h (threshold 3%) — rule gr_01', status: 'Withdrawn', publisher_email: 'publisher@gmail.com', notifications: 4, resolution_notes: 'Publisher delinked at partner request pending remediation.' },
  { id: 'pol_06', site: 'atlasweekend.co', partner_ticket: 'AGX-1002', severity: 'info', detected_at: '2026-09-22T10:04:00Z', evidence: 'Geo mix outside contract tier-1 list — rule pr_04', status: 'Resolved', publisher_email: 'publisher@gmail.com', notifications: 1, resolution_notes: 'Partner confirmed campaign change; monitoring until 2026-12-31.' },
  { id: 'pol_07', site: 'northstar-weekly.com', partner_ticket: 'AGX-1001', severity: 'warning', detected_at: '2026-09-26T17:03:00Z', evidence: 'Parked-domain traffic 0.9% — rule gr_02', status: 'Open', publisher_email: 'ops@northstarpublishing.com', notifications: 1 },
]

export const notifications: AppNotification[] = [
  { id: 'nt_01', title: 'Publisher delinked automatically', body: 'coastalwire.news was withdrawn after critical IVT alert (4.82% vs 1% threshold).', type: 'alert', scope: 'both', created_at: '2026-10-05T04:12:00Z', is_read: false, delivery: 'sent' },
  { id: 'nt_02', title: 'Payment released', body: 'Signal House — $11,376.00 released for period Sep 2026. Ref PMT-2026-1005-01.', type: 'payment', scope: 'both', created_at: '2026-10-05T09:31:00Z', is_read: false, delivery: 'sent' },
  { id: 'nt_03', title: 'MCM sync recovered', body: 'GAM Primary status sync resumed after one retry at 22:16 UTC.', type: 'mcm', scope: 'admin', created_at: '2026-09-30T22:16:00Z', is_read: false, delivery: 'sent' },
  { id: 'nt_04', title: 'New publisher invite sent', body: 'northstar-games.io invited under AGX-1001 via MCM-001.', type: 'invite', scope: 'both', created_at: '2026-10-02T16:19:00Z', is_read: true, delivery: 'sent' },
  { id: 'nt_05', title: 'Policy issue opened', body: 'Parked-domain traffic detected on northstar-weekly.com.', type: 'policy', scope: 'both', created_at: '2026-09-26T17:03:00Z', is_read: true, delivery: 'sent' },
  { id: 'nt_06', title: 'Statement awaiting approval', body: 'ST-2026-088 (Vertex Media Labs, Sep 2026) is pending finance approval.', type: 'payment', scope: 'admin', created_at: '2026-10-04T12:00:00Z', is_read: true, delivery: 'sent' },
  { id: 'nt_07', title: 'Invite expired', body: 'northstar-video.tv invitation expired — no response from publisher.', type: 'invite', scope: 'both', created_at: '2026-07-11T09:00:00Z', is_read: true, delivery: 'failed' },
  { id: 'nt_08', title: 'Monthly CSV imported', body: 'September 2026 report imported: 184,220 rows, 0 errors.', type: 'system', scope: 'admin', created_at: '2026-10-02T09:14:00Z', is_read: true, delivery: 'sent' },
  { id: 'nt_09', title: 'Partner access suspended', body: 'Bloom Commerce portal access suspended pending onboarding review.', type: 'system', scope: 'admin', created_at: '2026-09-30T15:42:00Z', is_read: true, delivery: 'sent' },
  { id: 'nt_10', title: 'Re-invite available', body: 'signalhouse.media can be re-invited after withdrawal.', type: 'invite', scope: 'both', created_at: '2026-09-12T11:55:00Z', is_read: true, delivery: 'retried' },
]

export const auditLog: AuditEvent[] = [
  { id: 'aud_01', action: 'publisher.withdraw', actor: 'system (rule sr_01)', actor_role: 'Auto action', target_type: 'publisher', target_id: 'site_015', description: 'Auto-withdraw coastalwire.news after critical IVT.', previous_state: 'ACTIVE', new_state: 'WITHDRAWN', partner_ticket: 'AGX-1005', timestamp: '2026-10-05T04:12:00Z' },
  { id: 'aud_02', action: 'payment.release', actor: 'ben@adglobex.media', actor_role: 'Finance', target_type: 'payment', target_id: 'pay_01', description: 'Released $11,376.00 to Signal House for Sep 2026.', previous_state: 'Pending', new_state: 'Released', partner_ticket: 'AGX-1004', timestamp: '2026-10-05T09:31:00Z' },
  { id: 'aud_03', action: 'auth.login', actor: 'alex@adglobex.media', actor_role: 'Super Admin', target_type: 'user', target_id: 'usr_09', description: 'User logged in via Supabase.', previous_state: null, new_state: null, partner_ticket: null, timestamp: '2026-10-05T09:04:00Z' },
  { id: 'aud_04', action: 'publisher.invite', actor: 'ops@northstarpublishing.com', actor_role: 'Partner Admin', target_type: 'publisher', target_id: 'site_003', description: 'Invited northstar-games.io under MCM-001.', previous_state: 'DRAFT', new_state: 'INVITED', partner_ticket: 'AGX-1001', timestamp: '2026-10-02T16:19:00Z' },
  { id: 'aud_05', action: 'partner.update', actor: 'nadia@adglobex.media', actor_role: 'Operations', target_type: 'partner', target_id: 'ptn_4823', description: 'Changed status.', previous_state: 'ACTIVE', new_state: 'SUSPENDED', partner_ticket: 'AGX-1003', timestamp: '2026-09-30T15:42:00Z' },
  { id: 'aud_06', action: 'revenue.adjust', actor: 'ben@adglobex.media', actor_role: 'Finance', target_type: 'revenue_record', target_id: 'rv_07', description: 'Deducted $96.50 — source correction batch 2026-09-B.', previous_state: '741.18', new_state: '644.68', partner_ticket: 'AGX-1003', timestamp: '2026-09-29T13:11:00Z' },
  { id: 'aud_07', action: 'site.transfer', actor: 'alex@adglobex.media', actor_role: 'Super Admin', target_type: 'site', target_id: 'site_014', description: 'Operational reassignment of signalplay.app.', previous_state: 'AGX-1004', new_state: 'AGX-1004 (confirmed ownership)', partner_ticket: 'AGX-1004', timestamp: '2026-09-25T10:22:00Z' },
  { id: 'aud_08', action: 'rule.create', actor: 'alex@adglobex.media', actor_role: 'Super Admin', target_type: 'rule', target_id: 'sr_01', description: 'Created site override ivt_threshold for coastalwire.news.', previous_state: null, new_state: 'enabled, action=withdraw', partner_ticket: 'AGX-1005', timestamp: '2026-08-14T08:05:00Z' },
  { id: 'aud_09', action: 'csv.import', actor: 'ben@adglobex.media', actor_role: 'Finance', target_type: 'csv_import', target_id: 'csv_09', description: 'September 2026 report imported (184,220 rows, 0 errors).', previous_state: null, new_state: 'Imported', partner_ticket: null, timestamp: '2026-10-02T09:14:00Z' },
  { id: 'aud_10', action: 'policy.resolve', actor: 'nadia@adglobex.media', actor_role: 'Operations', target_type: 'policy_issue', target_id: 'pol_04', description: 'Resolved auto-refresh policy issue on signalhouse.media.', previous_state: 'In review', new_state: 'Resolved', partner_ticket: 'AGX-1004', timestamp: '2026-10-04T19:02:00Z' },
]

export const supportTickets: SupportTicket[] = [
  { id: 'TKT-1041', subject: 'Statement ST-2026-091 shows a deduction we do not recognise', partner_ticket: 'AGX-1002', requester: 'finance@atlasdigital.co', status: 'Waiting on partner', priority: 'High', created_at: '2026-10-04T14:20:00Z', updated_at: '2026-10-05T08:11:00Z' },
  { id: 'TKT-1040', subject: 'Re-invite signalhouse.media after withdrawal', partner_ticket: 'AGX-1004', requester: 'team@signalhouse.media', status: 'Open', priority: 'Normal', created_at: '2026-10-03T09:40:00Z', updated_at: '2026-10-03T09:40:00Z' },
  { id: 'TKT-1039', subject: 'northstar-video.tv invite expired — how to restart', partner_ticket: 'AGX-1001', requester: 'ops@northstarpublishing.com', status: 'Open', priority: 'Normal', created_at: '2026-10-01T16:02:00Z', updated_at: '2026-10-02T07:35:00Z' },
  { id: 'TKT-1038', subject: 'Cannot see October MCM report yet', partner_ticket: 'AGX-1007', requester: 'biz@harborline.news', status: 'Resolved', priority: 'Low', created_at: '2026-09-30T11:12:00Z', updated_at: '2026-10-01T10:04:00Z' },
  { id: 'TKT-1037', subject: 'Request to lower revenue share to 8%', partner_ticket: 'AGX-1006', requester: 'ops@vertexmedialabs.com', status: 'Closed', priority: 'Low', created_at: '2026-09-24T13:55:00Z', updated_at: '2026-09-28T15:20:00Z' },
]

export const healthChecks: HealthCheck[] = [
  { area: 'Sites', status: 'Healthy', detail: '248 total · 214 active · 18 pending · withdrawal ratio 4.1%', metric: '4.1% withdrawn', checked_at: '2026-10-05T09:15:00Z' },
  { area: 'MCM', status: 'Degraded', detail: 'MCM-001 healthy (sync 3 min ago). MCM-002 in maintenance — adapter disabled.', metric: '1 of 2 degraded', checked_at: '2026-10-05T09:14:00Z' },
  { area: 'Jobs', status: 'Healthy', detail: 'Queue depth 4 · 0 failed · 0 stale · 2 retries pending', metric: '4 queued', checked_at: '2026-10-05T09:15:00Z' },
  { area: 'Reporting', status: 'Healthy', detail: 'Last ingestion 2026-10-05 06:00 UTC · reconciliation passed · freshness 3h', metric: 'reconciled', checked_at: '2026-10-05T09:15:00Z' },
  { area: 'Revenue', status: 'Degraded', detail: '1 unreconciled batch (2026-10-04) · 0 missing periods · 0 duplicate detections', metric: '1 batch open', checked_at: '2026-10-05T09:15:00Z' },
  { area: 'API', status: 'Healthy', detail: 'p95 182ms · error rate 0.14% · 0 auth failures in last hour · 0 rate-limit events', metric: 'p95 182ms', checked_at: '2026-10-05T09:15:00Z' },
  { area: 'Database', status: 'Healthy', detail: '12/100 connections · 0 slow queries · last backup 2026-10-05 03:00 UTC', metric: '12 conns', checked_at: '2026-10-05T09:15:00Z' },
]

const row = (
  site: string, traffic_source: string, device: string, country: string, carrier: string, browser: string,
  impressions: number, clicks: number, revenue: number, ad_requests: number, fill_rate: number,
): ReportRow => ({
  site, traffic_source, device, country, carrier, browser, impressions, clicks, revenue,
  ecpm: Number((revenue / impressions) * 1000).toFixed(2) as unknown as number,
  ctr: Number((clicks / impressions) * 100).toFixed(2) as unknown as number,
  ad_requests, fill_rate,
})

export const reportRows: ReportRow[] = [
  row('northstarpublishing.com', 'Search', 'Mobile', 'United States', 'Verizon', 'Chrome', 4820113, 141204, 4318.42, 5402110, 89.2),
  row('northstarpublishing.com', 'Direct', 'Desktop', 'United States', 'Comcast', 'Safari', 2140992, 58117, 1902.44, 2410022, 88.8),
  row('northstar-daily.net', 'Social', 'Mobile', 'United Kingdom', 'EE', 'Chrome', 3114880, 88312, 2740.05, 3600441, 86.5),
  row('atlasdaily.co', 'Search', 'Desktop', 'Germany', 'Telekom', 'Firefox', 2650422, 71908, 2298.77, 2998110, 88.4),
  row('atlasbiz.com', 'Email', 'Desktop', 'France', 'Orange', 'Edge', 2114003, 58331, 1922.6, 2440998, 86.6),
  row('signalwire.tv', 'Video referral', 'Connected TV', 'Canada', 'Rogers', 'Chrome', 1904772, 52144, 1712.3, 2280114, 83.5),
  row('vertexlabs.io', 'Search', 'Tablet', 'Australia', 'Telstra', 'Safari', 1502118, 41880, 1310.44, 1712004, 87.7),
  row('harborline.news', 'Direct', 'Mobile', 'Netherlands', 'KPN', 'Chrome', 1288440, 35019, 1140.92, 1470220, 87.6),
  row('signalplay.app', 'Referral', 'Mobile', 'India', 'Jio', 'Chrome', 1122004, 30552, 996.11, 1355002, 82.8),
  row('bloomcommerce.io', 'Shopping', 'Mobile', 'Spain', 'Movistar', 'Chrome', 902331, 24117, 741.18, 1120440, 80.5),
  row('northstar-games.io', 'Gaming portal', 'Desktop', 'United States', 'Comcast', 'Chrome', 774220, 26008, 816.9, 890112, 87.0),
  row('coastalwire.news', 'Aggregator', 'Mobile', 'Brazil', 'Vivo', 'Chrome', 640012, 12884, 402.55, 902114, 70.9),
]

export const dashboardSummary: DashboardSummary = {
  revenue: 184600, impressions: 42800000, clicks: 1258000, ecpm: 4.31, ctr: 2.94,
  ad_requests: 49500000, fill_rate: 86.4, gross_revenue: 205111, parent_share: 18460,
  total_publishers: 248, active_publishers: 186,
}

export const partnerDashboardSummary: DashboardSummary = {
  revenue: 28420, impressions: 9680113, clicks: 287633, ecpm: 2.94, ctr: 2.97,
  ad_requests: 11040114, fill_rate: 87.7, gross_revenue: 31578, parent_share: 3158,
  total_publishers: 5, active_publishers: 3,
}

/** Daily revenue trend used by the Home charts (§5.1 / §6.1). */
export const revenueTrend = [
  { label: 'Sep 06', value: 5120 }, { label: 'Sep 10', value: 5480 }, { label: 'Sep 14', value: 5310 },
  { label: 'Sep 18', value: 6240 }, { label: 'Sep 22', value: 6890 }, { label: 'Sep 26', value: 6410 },
  { label: 'Sep 30', value: 7250 }, { label: 'Oct 04', value: 7940 },
]

export const partnerTrend = [
  { label: 'Sep 06', value: 840 }, { label: 'Sep 10', value: 910 }, { label: 'Sep 14', value: 880 },
  { label: 'Sep 18', value: 1040 }, { label: 'Sep 22', value: 1120 }, { label: 'Sep 26', value: 1080 },
  { label: 'Sep 30', value: 1240 }, { label: 'Oct 04', value: 1360 },
]

export const activityFeed = [
  { text: 'coastalwire.news auto-withdrawn by critical IVT rule', time: '12 min ago', kind: 'alert' },
  { text: 'Payment of $11,376.00 released to Signal House', time: '41 min ago', kind: 'payment' },
  { text: 'Northstar Publishing invited northstar-games.io to GAM', time: '2 hrs ago', kind: 'invite' },
  { text: 'MCM status sync recovered after one retry', time: '3 hrs ago', kind: 'mcm' },
  { text: 'September CSV imported — 184,220 rows, 0 errors', time: '5 hrs ago', kind: 'system' },
]
