'use client'

import { useEffect, useState } from 'react'
import {
  Bell, CircleDollarSign, Network, ShieldAlert, ShieldCheck, Users,
} from 'lucide-react'
import { Chip, EmptyView, LoadingRows, PageHeader, Panel, Tabs } from '@/components/kit'
import { useNotifications } from '@/lib/hooks'
import { usePortal } from '@/lib/portal'
import type { AppNotification } from '@/lib/data/types'

const tabDefs = [
  { label: 'All', value: 'all' },
  { label: 'Unread', value: 'unread' },
  { label: 'Payments', value: 'payment' },
  { label: 'Invites', value: 'invite' },
  { label: 'Alerts', value: 'alert' },
  { label: 'Policy', value: 'policy' },
  { label: 'MCM', value: 'mcm' },
]

const deliveryTone: Record<AppNotification['delivery'], string> = {
  queued: 'neutral',
  sent: 'success',
  failed: 'critical',
  retried: 'warning',
}

function iconFor(type: AppNotification['type']) {
  if (type === 'payment') return CircleDollarSign
  if (type === 'invite') return Users
  if (type === 'alert') return ShieldCheck
  if (type === 'policy') return ShieldAlert
  if (type === 'mcm') return Network
  return Bell
}

function formatStamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function NotificationsPage() {
  const { portal } = usePortal()
  const query = useNotifications(portal)
  const [items, setItems] = useState<AppNotification[]>([])
  const [tab, setTab] = useState('all')

  useEffect(() => {
    if (query.data) setItems(query.data)
  }, [query.data])

  const unread = items.filter((n) => !n.is_read).length
  const sentToday = items.filter((n) => n.delivery === 'sent').length
  const failed = items.filter((n) => n.delivery === 'failed').length

  const tabs = tabDefs.map((def) => ({
    ...def,
    count: query.isLoading
      ? undefined
      : def.value === 'all'
        ? items.length
        : def.value === 'unread'
          ? unread
          : items.filter((n) => n.type === def.value).length,
  }))

  const rows = items.filter((n) => {
    if (tab === 'all') return true
    if (tab === 'unread') return !n.is_read
    return n.type === tab
  })

  function toggleRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: !n.is_read } : n)))
  }

  function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  return (
    <>
      <PageHeader
        eyebrow="WORKSPACE"
        title="Notifications"
        subtitle="In-app notification centre with read/unread state. Email delivery status is tracked separately (queued, sent, failed, retried)."
        actions={
          <button className="primary-button" type="button" onClick={markAllRead} disabled={query.isLoading}>
            Mark all as read
          </button>
        }
      />

      {query.isLoading ? (
        <section className="stats-grid" aria-label="Notification summary">
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="stat-card" key={i}>
              <LoadingRows rows={1} cols={1} />
            </div>
          ))}
        </section>
      ) : (
        <div className="metric-row">
          <div className="metric">
            <span>Unread</span>
            <strong>{unread}</strong>
            <small>waiting for your attention</small>
          </div>
          <div className="metric">
            <span>Sent today</span>
            <strong>{sentToday}</strong>
            <small>delivered by email and in-app</small>
          </div>
          <div className="metric">
            <span>Failed deliveries</span>
            <strong>{failed}</strong>
            <small>queued for automatic retry</small>
          </div>
        </div>
      )}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {query.isLoading ? (
        <Panel kicker="INBOX" title="Recent notifications">
          <LoadingRows rows={6} cols={3} />
        </Panel>
      ) : rows.length === 0 ? (
        <EmptyView
          title="You're all caught up"
          description="Nothing in this view right now. New invites, payments and policy events will land here as they happen."
          action="Show everything"
          onAction={() => setTab('all')}
        />
      ) : (
        <Panel kicker="INBOX" title="Recent notifications">
          <div className="activity-list">
            {rows.map((n) => {
              const Icon = iconFor(n.type)
              return (
                <div className="activity-item" key={n.id}>
                  <div className="activity-icon">
                    <Icon />
                  </div>
                  <div className="activity-copy" style={{ flex: 1 }}>
                    <p>{n.is_read ? n.title : <strong>{n.title}</strong>}</p>
                    <p style={{ marginTop: 4 }}>{n.body}</p>
                    <span>{formatStamp(n.created_at)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Chip tone={deliveryTone[n.delivery]}>{n.delivery}</Chip>
                    <button className="text-button" type="button" onClick={() => toggleRead(n.id)}>
                      {n.is_read ? 'Mark unread' : 'Mark read'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      )}
    </>
  )
}
