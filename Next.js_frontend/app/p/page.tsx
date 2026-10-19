'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity, ArrowUpRight, Boxes, CircleDollarSign, MousePointerClick,
} from 'lucide-react'
import {
  DataTable, ErrorPanel, FilterRow, LiveStatus, LoadingRows, PageHeader, Panel, StatCard,
  Status, TrendChart, type Column,
} from '@/components/kit'
import { usePartnerSummary } from '@/lib/partner-api'
import { isIsoDate, todayIso } from '@/lib/date'

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtInt = (n: number) => n.toLocaleString('en-US')

/** Shifts an ISO date by whole days. Used by the range presets. */
function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** "2026-10-09T03:41:01.247498000Z" -> "2026-10-09 03:41" (UTC). */
function formatUtc(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toISOString().replace('T', ' ').slice(0, 16)
}

interface TopSite {
  label: string
  domain: string
  networkCode: string
  accountStatus: string
  revenue: number
  impressions: number
  clicks: number
}

const topColumns: Column<TopSite>[] = [
  { key: 'domain', header: 'Site', render: (s) => <strong style={{ color: '#3a3a39' }}>{s.domain}</strong> },
  { key: 'code', header: 'Network code', render: (s) => s.networkCode },
  { key: 'status', header: 'Status', render: (s) => <Status value={s.accountStatus || 'unknown'} /> },
  { key: 'impressions', header: 'Impressions', render: (s) => s.impressions.toLocaleString('en-US') },
  { key: 'clicks', header: 'Clicks', render: (s) => s.clicks.toLocaleString('en-US') },
  { key: 'revenue', header: 'Revenue', render: (s) => money(s.revenue) },
]

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: '7 days', days: 6 },
  { label: '30 days', days: 29 },
] as const

export default function PartnerHomePage() {
  const today = todayIso()

  // The window drives revenue, split, trend and the headline cards. Defaults
  // to today; the two inputs allow a span (2nd → 10th) or a single day
  // (from === to).
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)

  const range = useMemo(() => ({ from, to }), [from, to])
  const summary = usePartnerSummary(range)
  const d = summary.data
  const tag = d?.partner.tag.toUpperCase() ?? ''

  const isSingleDay = from === to
  const isToday = from === today && to === today
  const rangeText = isSingleDay ? from : `${from} → ${to}`
  const syncedLabel = formatUtc(d?.meta.lastSyncedAt ?? null)

  // Guard the two ends so "from" can never sit after "to" — the API swaps them
  // too, but keeping the UI consistent avoids a confusing flash.
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

  const perf = d?.performance
  const range_ = d?.range

  const stats = [
    {
      title: isToday ? 'Revenue today' : 'Revenue',
      value: perf ? money(perf.revenue) : '—',
      icon: CircleDollarSign,
      helper: `${range_?.sitesEarning ?? 0} sites earning${isToday ? ' today' : ` in ${rangeText}`}`,
    },
    {
      title: 'Impressions',
      value: perf ? fmtInt(perf.impressions) : '—',
      icon: Activity,
      helper: isSingleDay ? 'served today across all your sites' : `served across all your sites (${rangeText})`,
    },
    {
      title: 'Clicks',
      value: perf ? fmtInt(perf.clicks) : '—',
      icon: MousePointerClick,
      helper: perf && perf.impressions
        ? `CTR ${perf.ctr.toFixed(2)}%`
        : 'no impressions in this range',
    },
    {
      title: 'Active sites',
      value: d ? `${d.sites.active} / ${d.sites.total}` : '—',
      icon: Boxes,
      helper: `${d?.sites.invited ?? 0} invites pending`,
    },
  ]

  if (summary.isError) {
    return (
      <>
        <PageHeader
          eyebrow={`PARTNER ${tag}`}
          title="Your performance"
          subtitle="Live figures from the reporting warehouse."
        />
        <ErrorPanel message={(summary.error as Error).message} onRetry={() => summary.refetch()} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow={`PARTNER ${tag}`}
        title="Your performance"
        subtitle="Live revenue, impressions and site health for every property under your account."
      />

      <FilterRow>
        <LiveStatus>{syncedLabel ? `Synced ${syncedLabel} UTC` : 'Waiting for sync'}</LiveStatus>

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
      </FilterRow>

      <section className="stats-grid" aria-label="Summary">
        {summary.isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div className="stat-card" key={i}><LoadingRows rows={1} cols={1} /></div>
            ))
          : stats.map((s) => <StatCard key={s.title} {...s} />)}
      </section>

      <section className="dashboard-grid dashboard-grid-split">
        <Panel
          kicker="REVENUE TREND"
          title="Daily revenue"
          className="performance-panel"
        >
          {summary.isLoading ? (
            <LoadingRows rows={4} cols={6} />
          ) : (
            <>
              <div className="chart-summary">
                <strong>{perf ? money(perf.revenue) : money(0)}</strong>
                <small>
                  revenue {isSingleDay ? `on ${from}` : `over ${rangeText}`}
                </small>
              </div>

              <div className="trend-figures">
                <div>
                  <span>Impressions</span>
                  <strong>{perf ? fmtInt(perf.impressions) : '—'}</strong>
                </div>
                <div>
                  <span>Clicks</span>
                  <strong>{perf ? fmtInt(perf.clicks) : '—'}</strong>
                </div>
                <div>
                  <span>ECPM</span>
                  <strong>{perf && perf.impressions ? money(perf.ecpm) : '—'}</strong>
                </div>
                <div>
                  <span>Days in range</span>
                  <strong>{d?.trend.points.length ?? 0}</strong>
                </div>
              </div>

              <div className="chart-legend" style={{ marginTop: 18 }}>
                <span><i className="legend-dot orange" />Revenue</span>
                <span><i className="legend-dot pale" />Impressions</span>
              </div>

              {(d?.trend.points.length ?? 0) > 0 ? (
                <TrendChart
                  data={d!.trend.points.map((p) => ({ label: (p.date ?? '').slice(5), value: p.revenue }))}
                  secondary={d!.trend.points.map((p) => ({
                    label: (p.date ?? '').slice(5),
                    value: p.impressions,
                  }))}
                />
              ) : (
                <div className="table-empty">No Data Found</div>
              )}
            </>
          )}
        </Panel>

        <div className="split-cards">
          <Panel kicker="FILL RATE" title="Fill rate">
            {summary.isLoading ? (
              <LoadingRows rows={2} cols={2} />
            ) : (
              <div className="metric-row" style={{ gridTemplateColumns: '1fr' }}>
                <div className="metric">
                  <span>Fill rate</span>
                  <strong>
                    {d?.fillRateAvailable ? `${d.fillRate.toFixed(1)}%` : '—'}
                  </strong>
                  <small>
                    {d?.fillRateAvailable
                      ? 'ad requests filled over ' + rangeText
                      : 'no fill data for this range'}
                  </small>
                </div>
              </div>
            )}
          </Panel>

          <Panel kicker="PARENT SHARE" title="Gross Parent Total">
            {summary.isLoading ? (
              <LoadingRows rows={2} cols={2} />
            ) : (
              <div className="metric-row" style={{ gridTemplateColumns: '1fr' }}>
                <div className="metric">
                  <span>Gross Parent Total</span>
                  <strong>{money(d?.grossParentTotal ?? 0)}</strong>
                  <small>your share of {rangeText} revenue</small>
                </div>
              </div>
            )}
          </Panel>
        </div>
      </section>

      <section className="panel partners-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">TOP PERFORMERS</p>
            <h2>{isToday ? 'Your best sites today' : `Your best sites (${rangeText})`}</h2>
          </div>
          <div className="table-actions">
            <Link className="secondary-button" href="/p/sites">
              View all sites <ArrowUpRight />
            </Link>
          </div>
        </div>

        {summary.isLoading ? (
          <LoadingRows rows={5} cols={6} />
        ) : (
          <DataTable
            columns={topColumns}
            rows={d?.topSites ?? []}
            rowKey={(s) => s.networkCode}
            empty="No site record found"
          />
        )}
      </section>

      {d ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">ACCOUNT</p>
              <h2>Inventory summary</h2>
            </div>
          </div>
          <div className="metric-row">
            <div className="metric">
              <span>Total sites</span>
              <strong>{d.sites.total}</strong>
              <small>network codes tagged {tag}</small>
            </div>
            <div className="metric">
              <span>Active</span>
              <strong>{d.sites.active}</strong>
              <small>approved and serving</small>
            </div>
            <div className="metric">
              <span>Invited</span>
              <strong>{d.sites.invited}</strong>
              <small>awaiting publisher action</small>
            </div>
            <div className="metric">
              <span>Inactive</span>
              <strong>{d.sites.inactive}</strong>
              <small>not currently serving</small>
            </div>
            <div className="metric">
              <span>Declined</span>
              <strong>{d.sites.declined}</strong>
              <small>invitation declined</small>
            </div>
          </div>
        </section>
      ) : null}
    </>
  )
}
