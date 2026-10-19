/** Shared types mirroring the AdGlobeX MA Business Management System contract. */

export type Portal = 'admin' | 'partner'

export type PartnerStatus = 'ACTIVE' | 'DISABLED' | 'SUSPENDED' | 'CLOSED'

export interface Partner {
  id: string
  partner_ticket: string
  name: string
  type: 'Media partner' | 'Agency' | 'Advertiser' | 'Publisher'
  contact_name: string
  contact_email: string
  revenue_share: number
  status: PartnerStatus
  sites: number
  active_sites: number
  revenue: number
  mcm: string
  created_at: string
  updated_at: string
  last_login: string | null
  notes: string
}

export interface PartnerUser {
  id: string
  partner_ticket: string
  full_name: string
  email: string
  role: 'Super Admin' | 'Admin' | 'Operations' | 'Finance' | 'Support' | 'Partner Admin' | 'Partner User' | 'Partner Read Only'
  status: 'Active' | 'Disabled' | 'Invited'
  last_login: string | null
  created_at: string
}

/** Publisher / site relationship. Lifecycle and API health are stored separately (doc §7). */
export type LifecycleStatus = 'DRAFT' | 'PENDING' | 'INVITED' | 'ACCEPTED' | 'ACTIVE' | 'WITHDRAWN' | 'DECLINED' | 'CLOSED' | 'EXPIRED'
export type ApiStatus = 'OK' | 'SYNCING' | 'API_ERROR' | 'NOT_INVITED'

export interface PublisherSite {
  id: string
  publisher_ticket: string
  site: string
  canonical_site: string
  partner_ticket: string
  partner_name: string
  status: LifecycleStatus
  api_status: ApiStatus
  delegation: 'MA' | 'MI'
  ads_txt: 'Verified' | 'Unverified' | 'Missing line' | 'Blocked'
  publisher_email: string
  network_code: string
  revenue_share: number
  mcm: string
  last_invite: string | null
  onboarding_date: string
  updated_at: string
}

export type RuleScope = 'global' | 'partner' | 'site'
export type RuleMetric = 'ivtool' | 'traffic_source' | 'country' | 'revenue_anomaly' | 'api_health'
export type RuleOperator = '>' | '<' | '=' | 'in' | 'not_in' | 'rate_change'
export type RuleSeverity = 'info' | 'warning' | 'critical'
export type RuleAction = 'monitor' | 'alert' | 'review' | 'restrict' | 'withdraw'

export interface Rule {
  id: string
  scope: RuleScope
  rule_key: string
  metric: RuleMetric
  operator: RuleOperator
  threshold: string
  severity: RuleSeverity
  action: RuleAction
  enabled: boolean
  partner_ticket?: string
  site?: string
  effective_from: string
  effective_to: string | null
  reason: string
}

export interface AlertEvent {
  id: string
  rule_key: string
  scope: RuleScope
  partner_ticket: string
  site: string
  metric: RuleMetric
  measured_value: string
  threshold: string
  severity: RuleSeverity
  action: RuleAction
  status: 'Open' | 'In review' | 'Resolved' | 'Auto action applied'
  triggered_at: string
  result: string
}

export interface RevenueRecord {
  id: string
  date: string
  partner_ticket: string
  partner_name: string
  site: string
  impressions: number
  clicks: number
  gross: number
  adjustments: number
  net: number
  partner_share: number
  adglobe_share: number
  state: 'provisional' | 'validated' | 'reconciled' | 'finalized' | 'adjusted'
}

export interface Statement {
  id: string
  partner_ticket: string
  partner_name: string
  period: string
  period_start: string
  period_end: string
  gross: number
  adjustments: number
  net_payable: number
  status: 'Draft' | 'Pending approval' | 'Approved' | 'Processing' | 'Paid' | 'On hold'
  due_date: string
}

export interface Payment {
  id: string
  partner_ticket: string
  partner_name: string
  amount: number
  currency: string
  period_start: string
  period_end: string
  status: 'Pending' | 'Processing' | 'Released' | 'On hold' | 'Failed'
  released_date: string | null
  reference: string
  statement_ref: string
  adjustments: number
}

export interface CsvImport {
  id: string
  month: string
  year: number
  uploaded_at: string
  uploader: string
  file_hash: string
  rows: number
  errors: number
  status: 'Imported' | 'Validating' | 'Preview' | 'Failed'
}

export interface McmConnection {
  mcm_id: string
  mcm_name: string
  provider_type: string
  account_reference: string
  status: 'Active' | 'Disabled' | 'Error' | 'Maintenance'
  default_flag: boolean
  priority: number
  capabilities: string[]
  last_success_sync: string
  last_attempted_sync: string
  last_error: string | null
  relationships: number
  health: 'Healthy' | 'Degraded' | 'Down'
}

export interface McmRelationship {
  id: string
  site: string
  partner_ticket: string
  mcm_id: string
  network_code: string
  invite_state: 'Not sent' | 'Sent' | 'Accepted' | 'Declined' | 'Expired' | 'Withdrawn'
  api_status: ApiStatus
  last_sync: string
  status_history: { at: string; from: string; to: string }[]
}

export interface PolicyIssue {
  id: string
  site: string
  partner_ticket: string
  severity: RuleSeverity
  detected_at: string
  evidence: string
  status: 'Open' | 'In review' | 'Resolved' | 'Withdrawn'
  publisher_email: string
  notifications: number
  resolution_notes?: string
}

export interface AppNotification {
  id: string
  title: string
  body: string
  type: 'invite' | 'alert' | 'policy' | 'mcm' | 'payment' | 'system'
  scope: 'admin' | 'partner' | 'both'
  created_at: string
  is_read: boolean
  delivery: 'queued' | 'sent' | 'failed' | 'retried'
}

/**
 * A row from the BigQuery `notifications` table, served by
 * `apps.notifications.NotificationViewSet`.
 *
 * Scoping is server-side: the view resolves `recipient_user_id` from the
 * authenticated user, so a caller cannot read or mark another user's rows.
 * `notification_type` and `severity` are free-form strings on the wire (the
 * table has no enum), so they are typed as string rather than a union.
 */
export interface SmartNotification {
  notification_id: string
  recipient_user_id: string
  partner_id: string
  notification_type: string
  title: string
  message: string
  /** Defaults to 'INFO' on the table. */
  severity: string
  is_read: boolean
  reference_type: string
  reference_id: string
  created_at: string
}

/**
 * Admin view of a partner publisher-submission request
 * (`MA_BOT_DATA.partner_submission_requests`).
 *
 * `unread` is a blocked duplicate awaiting admin action; `failed` is a GAM
 * error that already told the partner to contact support; `submitted` is a
 * successful create.
 */
export interface AdminSubmission {
  requestId: string
  partnerTag: string
  partnerEmail: string | null
  partnerName: string | null
  partnerUserId: string | null
  site: string
  childName: string
  gamEmail: string
  networkCode: string
  revenueShareMillipercent: number
  delegationType: string
  note: string | null
  status: string
  reason: string | null
  existingPartnerTag: string | null
  existingLabel: string | null
  gamCompanyId: string | null
  gamInvitationStatus: string | null
  errorMessage: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface AuditEvent {
  id: string
  action: string
  actor: string
  actor_role: string
  target_type: string
  target_id: string
  description: string
  previous_state: string | null
  new_state: string | null
  partner_ticket: string | null
  timestamp: string
}

export interface SupportTicket {
  id: string
  subject: string
  partner_ticket: string
  requester: string
  status: 'Open' | 'Waiting on partner' | 'Resolved' | 'Closed'
  priority: 'Low' | 'Normal' | 'High' | 'Urgent'
  created_at: string
  updated_at: string
}

export interface ReportRow {
  site: string
  traffic_source: string
  device: string
  country: string
  carrier: string
  browser: string
  /**
   * GAM child network code. Only present when the request asked for the
   * `network_code` dimension (the Site tab does), so the Site cell can link to
   * the single-publisher drill-down page.
   */
  network_code?: string
  impressions: number
  clicks: number
  revenue: number
  ecpm: number
  ctr: number
  ad_requests: number
  fill_rate: number
  applicable_revenue?: number
  not_applicable_revenue?: number
  ios_pct?: number
}

export interface DashboardSummary {
  revenue: number
  impressions: number
  clicks: number
  ecpm: number
  ctr: number
  ad_requests: number
  fill_rate: number
  applicable_revenue?: number
  not_applicable_revenue?: number
  ios_pct?: number
  gross_revenue: number
  parent_share: number
  total_publishers: number
  active_publishers: number
}

export interface HealthCheck {
  area: string
  status: 'Healthy' | 'Degraded' | 'Down'
  detail: string
  metric: string
  checked_at: string
}

/** BigQuery-backed list envelope used by every backend list endpoint. */
export interface Page<T> {
  count: number
  results: T[]
  page: number
  page_size: number
}
