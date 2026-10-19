'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import {
  Activity, CircleDollarSign, Gauge, Zap,
} from 'lucide-react'
import {
  DataTable, ErrorPanel, FilterRow, LiveStatus, LoadingRows, PageHeader, Pagination,
  Panel, StatCard, Tabs, type Column,
} from '@/components/kit'
import { usePublisherReport, usePublisherReportSummary } from '@/lib/hooks'
import { isIsoDate, shiftDays, todayIso } from '@/lib/date'
import type { ReportRow } from '@/lib/data/types'

interface Dimension {
  label: string
  value: string
  dims: string[]
}

/**
 * Identical to the /reporting dimension set, so the drill-down answers the
 * same questions the admin was already asking — only the scope changes.
 */
const DIMENSIONS: Dimension[] = [
  { label: 'Overview', value: 'overview', dims: [] },
  // network_code rides along so every row is attributable back to this child.
  { label: 'Site', value: 'site', dims: ['site', 'network_code'] },
  { label: 'Traffic Source', value: 'traffic_source', dims: ['traffic_source'] },
  { label: 'Device Category', value: 'device', dims: ['device'] },
  { label: 'Country', value: 'country', dims: ['country'] },
  { label: 'Carrier / ISP', value: 'carrier', dims: ['carrier'] },
  { label: 'Browser', value: 'browser', dims: ['browser'] },
  { label: 'Country-Carrier', value: 'country_carrier', dims: ['country', 'carrier'] },
]

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const metricColumns: Column<ReportRow>[] = [
  { key: 'impressions', header: 'Impressions', render: (r) => r.impressions.toLocaleString('en-US') },
  { key: 'clicks', header: 'Clicks', render: (r) => r.clicks.toLocaleString('en-US') },
  { key: 'revenue', header: 'Revenue', render: (r) => money(r.revenue) },
  { key: 'applicable_revenue', header: 'Applicable', render: (r) => (r.applicable_revenue !== undefined ? money(r.applicable_revenue) : '—') },
  { key: 'not_applicable_revenue', header: 'Not applicable', render: (r) => (r.not_applicable_revenue !== undefined ? money(r.not_applicable_revenue) : '—') },
  { key: 'ecpm', header: 'eCPM', render: (r) => (r.impressions ? money(r.ecpm) : '—') },
  { key: 'ctr', header: 'CTR', render: (r) => (r.impressions ? `${r.ctr.toFixed(2)}%` : '—') },
  { key: 'ios_pct', header: 'iOS %', render: (r) => (r.ios_pct !== undefined ? `${r.ios_pct.toFixed(1)}%` : '—') },
]

// Overview tab: hide the split/iOS columns (no breakdown context).
const overviewMetricColumns: Column<ReportRow>[] = [
  { key: 'impressions', header: 'Impressions', render: (r) => r.impressions.toLocaleString('en-US') },
  { key: 'clicks', header: 'Clicks', render: (r) => r.clicks.toLocaleString('en-US') },
  { key: 'revenue', header: 'Revenue', render: (r) => money(r.revenue) },
  { key: 'ecpm', header: 'eCPM', render: (r) => (r.impressions ? money(r.ecpm) : '—') },
  { key: 'ctr', header: 'CTR', render: (r) => (r.impressions ? `${r.ctr.toFixed(2)}%` : '—') },
]

const labelColumn = (
  key: 'site' | 'traffic_source' | 'device' | 'country' | 'carrier' | 'browser',
  header: string,
): Column<ReportRow> => ({
  key,
  header,
  render: (r) => <strong style={{ color: '#3a3a39' }}>{r[key]}</strong>,
})

const siteColumn = (networkCode: string): Column<ReportRow> => ({
  key: 'site',
  header: 'Site',
  render: (r) => (
    <>
      <strong style={{ color: '#3a3a39', display: 'block' }}>{r.site}</strong>
      <span style={{ display: 'block', fontSize: 11, opacity: 0.65, fontWeight: 500 }}>{r.network_code || networkCode}</span>
    </>
  ),
})

const impressionColumn: Column<ReportRow> = {
  key: 'impressions',
  header: 'Impressions',
  render: (r) => r.impressions.toLocaleString('en-US'),
}

function columnsFor(dimension: string, networkCode: string): Column<ReportRow>[] {
  if (dimension === 'overview') return overviewMetricColumns
  if (dimension === 'site') return [siteColumn(networkCode), ...metricColumns]
  if (dimension === 'traffic_source') {
    return [labelColumn('traffic_source', 'Traffic source'), ...metricColumns]
  }
  // adx_os_stats carries impressions only — revenue/clicks/eCPM/CTR would be
  // permanently-zero columns, hidden the same way the parent page hides them.
  if (dimension === 'device') {
    return [labelColumn('device', 'Operating system'), impressionColumn]
  }
  if (dimension === 'country') return [labelColumn('country', 'Country'), ...metricColumns]
  if (dimension === 'carrier') return [labelColumn('carrier', 'Carrier / ISP'), ...metricColumns]
  if (dimension === 'browser') return [labelColumn('browser', 'Browser'), ...metricColumns]
  if (dimension === 'country_carrier') {
    return [labelColumn('country', 'Country'), labelColumn('carrier', 'Carrier / ISP'), ...metricColumns]
  }
  return metricColumns
}

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: '7 days', days: 6 },
  { label: '30 days', days: 29 },
] as const

/**
 * Reporting for one GAM child network code.
 *
 * Layout and behaviour are deliberately identical to /reporting — same header,
 * same range picker, same four summary cards, same dimension tabs, same query
 * result table. Only the scope differs, and it is taken from the path segment
 * rather than any browser-supplied filter.
 */
export default function PublisherReportPage() {
  const params = useParams<{ networkCode: string }>()
  const search = useSearchParams()
  const networkCode = params.networkCode

  // The referring page hands its window over in the URL so the drill-down
  // answers the same dates instead of silently resetting to today.
  const today = todayIso()
  const urlFrom = search.get('from')
  const urlTo = search.get('to')
  const [from, setFrom] = useState(isIsoDate(urlFrom ?? '') ? urlFrom! : today)
  const [to, setTo] = useState(isIsoDate(urlTo ?? '') ? urlTo! : today)
  const [page, setPage] = useState(1)
  const [active, setActive] = useState('overview')

  const range = useMemo(() => ({ from, to }), [from, to])
  const dimension = DIMENSIONS.find((d) => d.value === active) ?? DIMENSIONS[0]

  const summary = usePublisherReportSummary(networkCode, range)
  const report = usePublisherReport(networkCode, dimension.dims, { page, page_size: 8 }, range)

  const d = summary.data
  const isSingleDay = from === to
  const rangeText = isSingleDay ? from : `${from} → ${to}`

  const changeFrom = (v: string) => {
    if (!isIsoDate(v)) return
    setFrom(v)
    if (v > to) setTo(v)
    setPage(1)
  }
  const changeTo = (v: string) => {
    if (!isIsoDate(v)) return
    setTo(v)
    if (v < from) setFrom(v)
    setPage(1)
  }
  const applyPreset = (days: number) => {
    const end = todayIso()
    setTo(end)
    setFrom(shiftDays(end, -days))
    setPage(1)
  }

  const selectDimension = (value: string) => {
    setActive(value)
    setPage(1)
  }

  const stats = [
    {
      title: 'Revenue',
      value: d ? `$${(d.revenue / 1000).toFixed(1)}K` : '—',
      icon: CircleDollarSign,
      helper: isSingleDay ? `revenue on ${from}` : `revenue over ${rangeText}`,
    },
    {
      title: 'Impressions',
      value: d ? `${(d.impressions / 1_000_000).toFixed(1)}M` : '—',
      icon: Activity,
      helper: isSingleDay ? 'served today' : `served over ${rangeText}`,
    },
    {
      title: 'Fill rate',
      value: d ? `${Math.round(d.fill_rate)}%` : '—',
      icon: Gauge,
      helper: 'impressions relative to ad requests',
    },
    {
      title: 'eCPM',
      value: d ? `$${d.ecpm.toFixed(2)}` : '—',
      icon: Zap,
      helper: 'revenue per thousand impressions',
    },
  ]

  return (
    <>
      <Link className="back-link" href="/reporting">← All reporting</Link>

      <PageHeader
        eyebrow={networkCode}
        title="Reporting"
        subtitle={`Pre-aggregated performance for this network code only, over ${rangeText}. Every figure is scoped server-side.`}
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
          <span className="range-sep" aria-hidden="true">–</span>
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
              const activePreset = from === shiftDays(today, -p.days) && to === today
              return (
                <button
                  key={p.label}
                  type="button"
                  className={activePreset ? 'range-preset is-active' : 'range-preset'}
                  onClick={() => applyPreset(p.days)}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>
        <LiveStatus>Scoped to {networkCode}</LiveStatus>
      </FilterRow>

      <section className="stats-grid" aria-label="Reporting summary">
        {summary.isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div className="stat-card" key={i}>
                <LoadingRows rows={1} cols={1} />
              </div>
            ))
          : stats.map((s) => <StatCard key={s.title} {...s} />)}
      </section>

      <Tabs tabs={DIMENSIONS} active={active} onChange={selectDimension} />

      <Panel
        kicker="QUERY RESULT"
        title={`${dimension.label} — ${networkCode}`}
        className="report-result"
        actions={
          <LiveStatus>
            {report.isLoading ? 'Loading…' : report.data ? `${report.data.count} rows` : '—'}
          </LiveStatus>
        }
      >
        {report.isLoading ? (
          <LoadingRows rows={6} cols={8} />
        ) : report.isError ? (
          <ErrorPanel
            message="The pre-aggregated reporting table did not respond for this network code. Retry once the analytics job has finished."
            onRetry={() => report.refetch()}
          />
        ) : (
          <>
            <DataTable
              columns={columnsFor(dimension.value, networkCode)}
              rows={report.data?.results ?? []}
              rowKey={(r, i) => {
                const labels = [r.network_code, r.site, r.traffic_source, r.device, r.country]
                  .filter(Boolean)
                  .join('-')
                // Labels are not unique on their own: Overview requests no
                // dimensions at all, and dirty warehouse labels can repeat a
                // country/site across rows. The index disambiguates always.
                return `${labels || 'row'}-${i}`
              }}
              empty={`No rows returned for the ${dimension.label} dimension on ${networkCode} in the selected date range.`}
            />
            <Pagination
              page={page}
              pageSize={report.data?.page_size ?? 8}
              count={report.data?.count ?? 0}
              onPage={setPage}
            />
          </>
        )}
      </Panel>
    </>
  )
}
