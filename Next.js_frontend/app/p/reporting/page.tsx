'use client'

import { useMemo, useState } from 'react'
import {
  Activity, CircleDollarSign, Gauge, Zap,
} from 'lucide-react'
import {
  DataTable, ErrorPanel, FilterRow, LiveStatus, LoadingRows, PageHeader, Pagination,
  Panel, StatCard, Tabs, type Column, type TabDef,
} from '@/components/kit'
import { usePartnerReporting, type PartnerReportRow, type PartnerReporting } from '@/lib/partner-api'
import { isIsoDate, todayIso } from '@/lib/date'

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n)

/**
 * The breakdown tabs, rendered full width above the result table. Every value
 * maps to a dimension the partner reporting route can answer.
 */
const DIMENSIONS: TabDef[] = [
  { label: 'Overview', value: 'overview' },
  { label: 'Site', value: 'site' },
  { label: 'Traffic Source', value: 'traffic_source' },
  { label: 'Device Category', value: 'device' },
  { label: 'Country', value: 'country' },
  { label: 'Carrier / ISP', value: 'carrier' },
  { label: 'Browser', value: 'browser' },
  { label: 'Country-Carrier', value: 'country_carrier' },
]

const METRIC_COLUMNS: Column<PartnerReportRow>[] = [
  { key: 'impressions', header: 'Impressions', render: (r) => r.impressions.toLocaleString('en-US') },
  { key: 'clicks', header: 'Clicks', render: (r) => r.clicks.toLocaleString('en-US') },
  { key: 'revenue', header: 'Revenue', render: (r) => money(r.revenue) },
  { key: 'ecpm', header: 'eCPM', render: (r) => (r.impressions ? money(r.ecpm) : '—') },
  { key: 'ctr', header: 'CTR', render: (r) => (r.impressions ? `${r.ctr.toFixed(2)}%` : '—') },
]

const siteColumns: Column<PartnerReportRow>[] = [
  {
    key: 'site',
    header: 'Site',
    render: (r) => (
      <div>
        <strong style={{ display: 'block', color: '#3a3a39' }}>{r.site}</strong>
        <small style={{ color: '#aaa6a0', fontSize: 10 }}>{r.network_code}</small>
      </div>
    ),
  },
  { key: 'sources', header: 'Sources', render: (r) => r.traffic_source_count ?? 0 },
  ...METRIC_COLUMNS,
]

const trafficColumns: Column<PartnerReportRow>[] = [
  { key: 'traffic_source', header: 'Traffic source', render: (r) => <strong style={{ color: '#3a3a39' }}>{r.traffic_source}</strong> },
  ...METRIC_COLUMNS,
]

const deviceColumns: Column<PartnerReportRow>[] = [
  { key: 'device', header: 'Operating system', render: (r) => <strong style={{ color: '#3a3a39' }}>{r.device}</strong> },
  { key: 'impressions', header: 'Impressions', render: (r) => r.impressions.toLocaleString('en-US') },
]

const labelColumn = (key: 'country' | 'carrier' | 'browser', header: string): Column<PartnerReportRow> => ({
  key,
  header,
  render: (r) => <strong style={{ color: '#3a3a39' }}>{r[key]}</strong>,
})

const countryColumns: Column<PartnerReportRow>[] = [labelColumn('country', 'Country'), ...METRIC_COLUMNS]

const carrierColumns: Column<PartnerReportRow>[] = [labelColumn('carrier', 'Carrier / ISP'), ...METRIC_COLUMNS]

const browserColumns: Column<PartnerReportRow>[] = [labelColumn('browser', 'Browser'), ...METRIC_COLUMNS]

const countryCarrierColumns: Column<PartnerReportRow>[] = [
  labelColumn('country', 'Country'),
  labelColumn('carrier', 'Carrier / ISP'),
  ...METRIC_COLUMNS,
]

function columnsFor(dimension: string): Column<PartnerReportRow>[] {
  if (dimension === 'site') return siteColumns
  if (dimension === 'traffic_source') return trafficColumns
  if (dimension === 'device') return deviceColumns
  if (dimension === 'country') return countryColumns
  if (dimension === 'carrier') return carrierColumns
  if (dimension === 'browser') return browserColumns
  if (dimension === 'country_carrier') return countryCarrierColumns
  return METRIC_COLUMNS
}

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: '7 days', days: 6 },
  { label: '30 days', days: 29 },
] as const

/** Shifts an ISO date by whole days. Used by the range presets. */
function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Unique key for a result row.
 *
 * A `??` chain does NOT work here: it stops at the first defined field, and on
 * the country_carrier dimension `carrier` is defined before `country`. The
 * warehouse records "(none)" as the carrier for Wi-Fi traffic across 233
 * different countries, so every one of those rows collapsed onto the key
 * "(none)" and React dropped/duplicated them. Compose every label field the
 * row actually carries instead — each dimension selects only its own columns,
 * so single-key dimensions still yield a single value.
 */
function rowKeyFor(r: PartnerReportRow): string {
  const parts = [r.network_code, r.traffic_source, r.device, r.browser, r.country, r.carrier].filter(
    (v) => v !== undefined && v !== null && v !== '',
  )
  return parts.length ? parts.join(' | ') : 'total'
}

export default function PartnerReportingPage() {
  const today = todayIso()
  const [dimension, setDimension] = useState('overview')
  const [page, setPage] = useState(1)

  // Same window contract as the home page: defaults to today, and the two
  // inputs allow a span (2nd - 10th) or a single day (from === to). Every
  // figure below - cards and the result table - is driven by this range, so
  // changing it refetches all of them together.
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)

  const range = useMemo(() => ({ from, to }), [from, to])
  const reporting = usePartnerReporting({ dimension, page, ...range })
  const d = reporting.data
  const totals = d?.totals

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

  const stats = useMemo(() => {
    if (!totals) return []
    return [
      { title: 'Revenue', value: money(totals.revenue), icon: CircleDollarSign, helper: 'across all traffic sources' },
      { title: 'Impressions', value: compact(totals.impressions), icon: Activity, helper: `${totals.clicks.toLocaleString('en-US')} clicks` },
      { title: 'eCPM', value: totals.impressions ? money(totals.ecpm) : '—', icon: Zap, helper: 'revenue per thousand impressions' },
      { title: 'CTR', value: totals.impressions ? `${totals.ctr.toFixed(2)}%` : '—', icon: Gauge, helper: 'clicks relative to impressions' },
    ]
  }, [totals])

  const selectDimension = (value: string) => {
    setDimension(value)
    setPage(1)
  }

  if (reporting.isError) {
    return (
      <>
        <PageHeader eyebrow="ANALYTICS" title="Reporting" subtitle="How your inventory is performing." />
        <ErrorPanel message={(reporting.error as Error).message} onRetry={() => reporting.refetch()} />
      </>
    )
  }

  const activeLabel = DIMENSIONS.find((x) => x.value === dimension)?.label ?? 'Overview'

  // placeholderData keeps the previous result on screen while the next one loads,
  // which is what we want for paging but wrong for a dimension switch — it would
  // briefly show the old dimension's rows under the new heading. The response
  // echoes the dimension it was built for, so blank the table on a mismatch.
  const staleDimension = Boolean(d) && d!.dimension !== dimension

  return (
    <>
      <PageHeader
        eyebrow="ANALYTICS"
        title="Reporting"
        subtitle="Performance across your inventory, broken down by site, traffic source and device. Partner scope is resolved server-side from your session — never from the browser."
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

        <LiveStatus>
          {d
            ? `${d.count} row${d.count === 1 ? '' : 's'} · ${activeLabel}`
            : 'Loading aggregate'}
        </LiveStatus>
      </FilterRow>

      <section className="stats-grid" aria-label="Reporting summary">
        {reporting.isLoading && !d
          ? Array.from({ length: 4 }).map((_, i) => (
              <div className="stat-card" key={i}>
                <LoadingRows rows={1} cols={1} />
              </div>
            ))
          : stats.map((s) => <StatCard key={s.title} {...s} />)}
      </section>

      <Tabs tabs={DIMENSIONS} active={dimension} onChange={selectDimension} />

      <Panel kicker="QUERY RESULT" title={activeLabel} className="report-result">
        {(reporting.isLoading && !d) || staleDimension ? (
          <LoadingRows rows={8} cols={6} />
        ) : (
          <>
            <DataTable
              columns={columnsFor(dimension)}
              rows={d?.results ?? []}
              rowKey={rowKeyFor}
              empty={`No rows returned for the ${activeLabel} dimension.`}
            />
            {d && d.count > d.page_size ? (
              <Pagination page={d.page} pageSize={d.page_size} count={d.count} onPage={setPage} />
            ) : null}
          </>
        )}
      </Panel>
    </>
  )
}
