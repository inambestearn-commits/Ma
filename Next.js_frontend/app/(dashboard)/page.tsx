'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  Activity, ArrowUpRight, Boxes, CircleDollarSign, HeartPulse, Network, Plus, ShieldCheck,
  SlidersHorizontal, Users, Zap,
} from 'lucide-react'
import {
  DataTable, FilterRow, LiveStatus, LoadingRows, PageHeader, Panel, StatCard,
  Status, TrendChart, type Column,
} from '@/components/kit'
import { useActivity, useDashboard, usePartners, useSites, useTrend } from '@/lib/hooks'
import { usePortal } from '@/lib/portal'
import { isIsoDate, shiftDays, todayIso } from '@/lib/date'
import type { Partner, PublisherSite } from '@/lib/data/types'

const partColors = ['bg-[#ff875f]', 'bg-[#75b6c8]', 'bg-[#d99a67]', 'bg-[#a58fca]', 'bg-[#82b995]']

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

const partnerColumns: Column<Partner>[] = [
  {
    key: 'partner',
    header: 'Partner',
    render: (p) => (
      <div className="partner-cell">
        <div className={`partner-avatar ${partColors[p.partner_ticket.charCodeAt(6) % partColors.length]}`}>
          {initials(p.name)}
        </div>
        <div>
          <strong>{p.name}</strong>
          <span>Partner ID: {p.partner_ticket}</span>
        </div>
      </div>
    ),
  },
  { key: 'type', header: 'Type', render: (p) => p.type },
  { key: 'sites', header: 'Sites', render: (p) => `${p.active_sites} / ${p.sites}` },
  { key: 'revenue', header: 'Revenue', render: (p) => `$${p.revenue.toLocaleString()}` },
  { key: 'status', header: 'Relationship', render: (p) => <Status value={p.status} /> },
]

const siteColumns: Column<PublisherSite>[] = [
  { key: 'site', header: 'Site', render: (s) => <strong style={{ color: '#3a3a39' }}>{s.site}</strong> },
  { key: 'status', header: 'Status', render: (s) => <Status value={s.status} /> },
  { key: 'api', header: 'API', render: (s) => <Status value={s.api_status.replace('_', ' ')} /> },
  { key: 'delegation', header: 'Delegation', render: (s) => <span className="pill">{s.delegation}</span> },
  { key: 'ads', header: 'ads.txt', render: (s) => <Status value={s.ads_txt} /> },
]

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: '7 days', days: 6 },
  { label: '30 days', days: 29 },
] as const

export default function HomePage() {
  const { portal } = usePortal()
  const today = todayIso()

  // Same window contract as the partner portal: two date inputs (a span or a
  // single day) plus presets. Defaults to today.
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const range = useMemo(() => ({ from, to }), [from, to])

  const dashboard = useDashboard(portal, range)
  const trend = useTrend(portal, range)
  const activity = useActivity()
  const partners = usePartners({ page_size: 5 })
  const sites = useSites({ page_size: 5 })

  const d = dashboard.data
  const isPartner = portal === 'partner'
  const isSingleDay = from === to
  const rangeText = isSingleDay ? from : `${from} → ${to}`

  const changeFrom = (v: string) => {
    if (!isIsoDate(v)) return
    setFrom(v)
    if (v > to) setTo(v)
  }
  const changeTo = (v: string) => {
    if (!isIsoDate(v)) return
    setTo(v)
    if (v < from) setFrom(v)
  }
  const applyPreset = (days: number) => {
    const end = todayIso()
    setTo(end)
    setFrom(shiftDays(end, -days))
  }

  const stats = isPartner
    ? [
        { title: 'Total revenue', value: `$${((d?.revenue ?? 0) / 1000).toFixed(1)}K`, change: '12.4%', icon: CircleDollarSign, helper: isSingleDay ? `revenue on ${from}` : `revenue over ${rangeText}` },
        { title: 'Impressions', value: `${((d?.impressions ?? 0) / 1_000_000).toFixed(1)}M`, change: '9.1%', icon: Activity, helper: isSingleDay ? 'served today' : `served over ${rangeText}` },
        { title: 'Active publishers', value: String(d?.active_publishers ?? 0), change: '8.4%', icon: Boxes },
        { title: 'Fill rate', value: `${d?.fill_rate ?? 0}%`, change: '2.3%', icon: Zap },
      ]
    : [
        { title: 'Total revenue', value: `$${((d?.revenue ?? 0) / 1000).toFixed(1)}K`, change: '14.2%', icon: CircleDollarSign, helper: isSingleDay ? `revenue on ${from}` : `revenue over ${rangeText}` },
        { title: 'Total impressions', value: `${((d?.impressions ?? 0) / 1_000_000).toFixed(1)}M`, change: '11.8%', icon: Activity, helper: isSingleDay ? 'served today' : `served over ${rangeText}` },
        { title: 'Active partners', value: String(d?.active_publishers ?? 0), change: '8.4%', icon: Network },
        { title: 'System health', value: '99.8%', change: '0.2%', icon: HeartPulse },
      ]

  return (
    <>
      <PageHeader
        eyebrow="MONDAY, OCTOBER 5, 2026"
        title={isPartner ? 'Good morning, Dana.' : 'Good morning, Alex.'}
        subtitle={
          isPartner
            ? 'Your publishers, revenue and invites for the AGX-1001 scope.'
            : "Here's what's happening across your media network."
        }
        actions={
          isPartner ? (
            <Link className="primary-button" href="/publishers/new"><Plus /> Add publisher</Link>
          ) : (
            <Link className="primary-button" href="/partners/new"><Plus /> Create partner</Link>
          )
        }
      />

      <FilterRow>
        <div className="range-picker" role="group" aria-label="Date range">
          <label className="range-field">
            <span>From</span>
            <input
              className="input"
              type="date"
              value={from}
              max={today}
              onChange={(e) => changeFrom(e.target.value)}
            />
          </label>
          <span className="range-sep" aria-hidden="true">→</span>
          <label className="range-field">
            <span>To</span>
            <input
              className="input"
              type="date"
              value={to}
              max={today}
              onChange={(e) => changeTo(e.target.value)}
            />
          </label>
          <div className="range-presets">
            {PRESETS.map((p) => {
              const active = from === shiftDays(today, -p.days) && to === today
              return (
                <button
                  key={p.label}
                  type="button"
                  className={active ? 'range-preset is-active' : 'range-preset'}
                  onClick={() => applyPreset(p.days)}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>
        <LiveStatus>Data synced 2 min ago</LiveStatus>
      </FilterRow>

      <section className="stats-grid" aria-label="Summary">
        {dashboard.isLoading
          ? Array.from({ length: 4 }).map((_, i) => <div className="stat-card" key={i}><LoadingRows rows={1} cols={1} /></div>)
          : stats.map((s) => <StatCard key={s.title} {...s} />)}
      </section>

      <section className="dashboard-grid">
        <Panel
          kicker={isPartner ? 'PARTNER PERFORMANCE' : 'NETWORK GROWTH'}
          title={isPartner ? 'Revenue trend' : 'Partner activity'}
          className="performance-panel"
          actions={
            <div className="chart-legend">
              <span><i className="legend-dot orange" /> Revenue</span>
              <Link className="text-button" href="/reporting">Open report</Link>
            </div>
          }
        >
          {trend.isLoading ? (
            <LoadingRows rows={4} cols={6} />
          ) : (
            <>
              <div className="chart-summary">
                <strong>${((d?.revenue ?? 0) / 1000).toFixed(1)}K</strong>
                <span className="trend positive"><ArrowUpRight /> 18.6%</span>
                <small>gross revenue {isSingleDay ? `on ${from}` : `over ${rangeText}`}</small>
              </div>
              <TrendChart data={trend.data ?? []} />
            </>
          )}
        </Panel>

        <Panel kicker="LIVE FEED" title="Recent activity" actions={<Link className="text-button" href="/audit">View all</Link>}>
          {activity.isLoading ? (
            <LoadingRows rows={5} cols={1} />
          ) : (
            <div className="activity-list">
              {(activity.data ?? []).map((a, index) => (
                <div className="activity-item" key={`${index}-${a.text}`}>
                  <div className="activity-icon">
                    {a.kind === 'payment' ? <CircleDollarSign />
                      : a.kind === 'invite' ? <Users />
                      : a.kind === 'mcm' ? <Network />
                      : a.kind === 'alert' ? <ShieldCheck />
                      : <Zap />}
                  </div>
                  <div className="activity-copy">
                    <p>{a.text}</p>
                    <span>{a.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="panel partners-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">{isPartner ? 'YOUR INVENTORY' : 'DIRECTORY'}</p>
            <h2>{isPartner ? 'Recent publishers' : 'Recent partners'}</h2>
          </div>
          <div className="table-actions">
            <Link className="secondary-button" href={isPartner ? '/publishers' : '/partners'}>
              View all <ArrowUpRight />
            </Link>
          </div>
        </div>

        {isPartner ? (
          sites.isLoading ? (
            <LoadingRows rows={5} cols={5} />
          ) : (
            <DataTable
              columns={siteColumns}
              rows={(sites.data?.results ?? []).filter((s) => s.partner_ticket === 'AGX-1001')}
              rowKey={(s) => s.id}
            />
          )
        ) : partners.isLoading ? (
          <LoadingRows rows={5} cols={5} />
        ) : (
          <DataTable columns={partnerColumns} rows={partners.data?.results ?? []} rowKey={(p) => p.id} />
        )}
      </section>
    </>
  )
}
