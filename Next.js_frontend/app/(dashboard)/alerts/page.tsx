'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle, Bell, CircleDollarSign, Network, ShieldAlert, ShieldCheck, Users,
} from 'lucide-react'
import {
  Chip, EmptyView, ErrorPanel, FilterRow, LiveStatus, LoadingRows, PageHeader,
  Pagination, Panel, SearchField, Tabs,
} from '@/components/kit'
import {
  useAdminSubmissions, useMarkAllNotificationsRead, useMarkNotificationRead,
  useSmartNotifications,
} from '@/lib/hooks'
import type { AdminSubmission, SmartNotification } from '@/lib/data/types'

const PAGE_SIZE = 25

/** The table stores severity as a free string defaulting to 'INFO'. */
const normalizeSeverity = (value: string) => value.trim().toUpperCase() || 'INFO'

const severityTone: Record<string, string> = {
  CRITICAL: 'critical',
  ERROR: 'critical',
  WARNING: 'warning',
  INFO: 'info',
}

function severityIcon(severity: string) {
  if (severity === 'CRITICAL' || severity === 'ERROR') return ShieldAlert
  if (severity === 'WARNING') return AlertTriangle
  return Bell
}

function iconForType(type: string) {
  const value = type.toLowerCase()
  if (value.includes('payment') || value.includes('revenue')) return CircleDollarSign
  if (value.includes('invite') || value.includes('partner') || value.includes('submission')) return Users
  if (value.includes('policy')) return ShieldAlert
  if (value.includes('mcm') || value.includes('site')) return Network
  if (value.includes('alert')) return ShieldCheck
  return Bell
}

function stamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

type Tab = 'all' | 'unread' | 'critical' | 'warning' | 'info'

/**
 * Map a partner submission request onto the SmartNotification row shape so
 * both sources flow through the same activity list.
 *
 * - duplicate (status=unread)  -> WARNING, not read (admin action queue)
 * - gam_error (status=failed)  -> CRITICAL, not read
 * - created  (status=submitted) -> INFO, already read
 */
function submissionToRow(s: AdminSubmission): SmartNotification {
  const reason = (s.reason ?? '').toLowerCase()
  const status = s.status.toLowerCase()
  let severity = 'INFO'
  let isRead = true
  let title = 'Publisher submission'
  let message = ''

  if (status === 'unread' || reason === 'duplicate') {
    severity = 'WARNING'
    isRead = false
    title = 'Duplicate publisher blocked'
    message = `${s.site} (${s.childName}) was already held by ${s.existingPartnerTag ?? 'another partner'}. Contact the partner to resolve.`
  } else if (status === 'failed' || reason === 'gam_error') {
    severity = 'CRITICAL'
    isRead = false
    title = 'GAM invitation failed'
    message = s.errorMessage
      ? `GAM error for ${s.childName}: ${s.errorMessage}`
      : `GAM call failed for ${s.childName} (${s.site}).`
  } else {
    title = 'Publisher submission accepted'
    message = `${s.childName} was created in GAM for ${s.partnerTag}.`
  }

  return {
    notification_id: `sub-${s.requestId}`,
    recipient_user_id: '',
    partner_id: s.partnerTag,
    notification_type: 'submission',
    title,
    message,
    severity,
    is_read: isRead,
    reference_type: 'partner_submission',
    reference_id: s.requestId,
    created_at: s.createdAt ?? s.updatedAt ?? '',
  }
}

export default function SmartNotificationsPage() {
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Only All and Unread are answered by the API's is_read filter. Severity is
  // filtered on the loaded page, because the endpoint has no severity filter.
  const isRead = tab === 'unread' ? false : undefined
  const query = useSmartNotifications(isRead, page, PAGE_SIZE)
  const submissions = useAdminSubmissions()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  // Merge notifications with partner-submission events so the admin sees
  // blocked duplicates and GAM failures in the same inbox.
  const rows = useMemo(() => {
    const notifs = query.data?.results ?? []
    const subs = (submissions.data?.requests ?? []).map(submissionToRow)
    return [...notifs, ...subs].sort((a, b) =>
      (b.created_at ?? '').localeCompare(a.created_at ?? ''),
    )
  }, [query.data, submissions.data])

  const count = rows.length

  const unread = rows.filter((r) => !r.is_read).length
  const critical = rows.filter((r) => {
    const severity = normalizeSeverity(r.severity)
    return severity === 'CRITICAL' || severity === 'ERROR'
  }).length

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((row) => {
      const severity = normalizeSeverity(row.severity)
      if (tab === 'unread' && row.is_read) return false
      if (tab === 'critical' && severity !== 'CRITICAL' && severity !== 'ERROR') return false
      if (tab === 'warning' && severity !== 'WARNING') return false
      if (tab === 'info' && severity !== 'INFO') return false
      if (!needle) return true
      return (
        row.title.toLowerCase().includes(needle) ||
        row.message.toLowerCase().includes(needle) ||
        row.notification_type.toLowerCase().includes(needle) ||
        row.partner_id.toLowerCase().includes(needle)
      )
    })
  }, [rows, tab, search])

  const tabs = [
    { label: 'All', value: 'all', count: count },
    { label: 'Unread', value: 'unread', count: unread },
    { label: 'Critical', value: 'critical', count: critical },
    { label: 'Warning', value: 'warning' },
    { label: 'Info', value: 'info' },
  ]

  const changeTab = (value: string) => {
    setTab(value as Tab)
    // Severity tabs reuse the already-loaded page, so only reset when the
    // server-side filter actually changes.
    if (value === 'all' || value === 'unread') setPage(1)
  }

  const isLoading = query.isLoading || submissions.isLoading
  const isError = query.isError || submissions.isError

  return (
    <>
      <PageHeader
        eyebrow="INTELLIGENCE"
        title="Smart Notification"
        subtitle="Operational events raised against your account. Only your own notifications are returned — the recipient is resolved server-side from your session, never from the request."
        actions={
          <button
            className="primary-button"
            type="button"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending || isLoading || unread === 0}
          >
            Mark all as read
          </button>
        }
      />

      <FilterRow>
        <SearchField
          value={search}
          onChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          placeholder="Search titles, messages or types"
        />
        <LiveStatus>
          {isLoading ? 'Loading…' : `${count} notification${count === 1 ? '' : 's'}`}
        </LiveStatus>
      </FilterRow>

      <Tabs tabs={tabs} active={tab} onChange={changeTab} />

      {isLoading ? (
        <Panel kicker="INBOX" title="Your notifications">
          <LoadingRows rows={6} cols={3} />
        </Panel>
      ) : isError ? (
        <ErrorPanel
          message="The notification service did not respond. It reads from BigQuery, so retry once the analytics job has finished."
          onRetry={() => {
            query.refetch()
            submissions.refetch()
          }}
        />
      ) : visible.length === 0 ? (
        <EmptyView
          title={search ? 'No matches' : 'Nothing here'}
          description={
            search
              ? `No notification matches "${search}".`
              : tab === 'unread'
                ? 'You are all caught up.'
                : 'No notifications have been raised for your account yet.'
          }
          action={search ? 'Clear search' : undefined}
          onAction={() => setSearch('')}
        />
      ) : (
        <Panel
          kicker="INBOX"
          title={tab === 'unread' ? 'Unread notifications' : 'Your notifications'}
        >
          <div className="activity-list">
            {visible.map((row) => (
              <NotificationRow
                key={row.notification_id}
                row={row}
                busy={markRead.isPending && markRead.variables === row.notification_id}
                onToggle={() => markRead.mutate(row.notification_id)}
              />
            ))}
          </div>
          {tab === 'all' || tab === 'unread' ? (
            <Pagination
              page={page}
              pageSize={query.data?.page_size ?? PAGE_SIZE}
              count={count}
              onPage={setPage}
            />
          ) : null}
        </Panel>
      )}
    </>
  )
}

function NotificationRow({
  row,
  busy,
  onToggle,
}: {
  row: SmartNotification
  busy: boolean
  onToggle: () => void
}) {
  const severity = normalizeSeverity(row.severity)
  const TypeIcon = iconForType(row.notification_type)
  const SeverityIcon = severityIcon(severity)
  // Submission-sourced rows have no notifications-table id; hide the
  // mark-read toggle rather than POSTing a fake id.
  const canToggle = !row.notification_id.startsWith('sub-')

  return (
    <div className="activity-item">
      <div className="activity-icon">
        <TypeIcon />
      </div>
      <div className="activity-copy" style={{ flex: 1 }}>
        <p>
          {row.is_read ? row.title : <strong>{row.title}</strong>}
        </p>
        {row.message ? <p style={{ marginTop: 4 }}>{row.message}</p> : null}
        <span>
          {stamp(row.created_at)}
          {row.notification_type ? ` · ${row.notification_type}` : ''}
          {row.partner_id ? ` · ${row.partner_id}` : ''}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Chip tone={severityTone[severity] ?? 'neutral'}>
          <SeverityIcon style={{ width: 12, height: 12 }} /> {severity}
        </Chip>
        {canToggle ? (
          <button className="text-button" type="button" onClick={onToggle} disabled={busy}>
            {row.is_read ? 'Mark unread' : 'Mark read'}
          </button>
        ) : null}
      </div>
    </div>
  )
}
