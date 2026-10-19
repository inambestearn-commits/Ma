'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  DataTable, ErrorPanel, Field, FilterRow, LiveStatus, LoadingRows, PageHeader,
  Pagination, Panel, Select, type Column,
} from '@/components/kit'
import { useReportFilter, useTrafficSources } from '@/lib/hooks'
import { isIsoDate, shiftDays, todayIso } from '@/lib/date'
import type { FilterReportRow } from '@/lib/api'

const PAGE_SIZE = 25

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Empty / invalid / out-of-range text becomes "no threshold". */
function parseThreshold(text: string): number | null {
  if (text.trim() === '') return null
  const n = Number(text)
  if (!Number.isFinite(n) || n < 0 || n > 100) return null
  return n
}

/**
 * The Site cell opens the single-publisher drill-down, mirroring /reporting:
 * the filtered window rides along so the drill-down answers the same dates.
 */
const siteColumn = (from: string, to: string): Column<FilterReportRow> => ({
  key: 'site',
  header: 'Site',
  render: (r) => (
    <a
      href={`/reporting/${encodeURIComponent(r.network_code)}?from=${from}&to=${to}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: '#f0855a', fontWeight: 700, textDecoration: 'none', lineHeight: 1.3 }}
    >
      <div style={{ fontWeight: 700 }}>{r.site || r.network_code}</div>
      <div style={{ fontSize: 11, opacity: 0.65, fontWeight: 500 }}>{r.network_code}</div>
    </a>
  ),
})

function columnsFor(from: string, to: string): Column<FilterReportRow>[] {
  return [
    siteColumn(from, to),
    { key: 'revenue', header: 'Revenue', render: (r) => money(r.revenue) },
    { key: 'applicable_revenue', header: 'Applicable', render: (r) => money(r.applicable_revenue) },
    {
      key: 'not_applicable_revenue',
      header: 'Not applicable',
      render: (r) => money(r.not_applicable_revenue),
    },
    { key: 'na_pct', header: 'NA %', render: (r) => `${r.na_pct.toFixed(1)}%` },
    { key: 'ios_pct', header: 'iOS %', render: (r) => `${r.ios_pct.toFixed(1)}%` },
    { key: 'impressions', header: 'Impressions', render: (r) => r.impressions.toLocaleString('en-US') },
  ]
}

export default function FilterReportPage() {
  const today = todayIso()
  const [from, setFrom] = useState(() => shiftDays(today, -30))
  const [to, setTo] = useState(today)
  const [page, setPage] = useState(1)

  const [source, setSource] = useState('')
  const [naText, setNaText] = useState('')
  const [iosText, setIosText] = useState('')
  // Thresholds debounce so typing "70" doesn't fire on the "7".
  const [naPct, setNaPct] = useState<number | null>(null)
  const [iosPct, setIosPct] = useState<number | null>(null)
  useEffect(() => {
    const t = setTimeout(() => {
      setNaPct(parseThreshold(naText))
      setIosPct(parseThreshold(iosText))
    }, 350)
    return () => clearTimeout(t)
  }, [naText, iosText])

  const range = useMemo(
    () => (isIsoDate(from) && isIsoDate(to) ? { from, to } : undefined),
    [from, to],
  )
  const sources = useTrafficSources(range)

  const input = useMemo(
    () => ({
      range,
      trafficSources: source ? [source] : undefined,
      minNotApplicablePct: naPct,
      minIosPct: iosPct,
      page,
      pageSize: PAGE_SIZE,
    }),
    [range, source, naPct, iosPct, page],
  )
  const report = useReportFilter(input)

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

  const sourceOptions = [
    { value: '', label: 'All traffic sources' },
    ...(sources.data ?? []).map((s) => ({ value: s.value, label: s.value })),
  ]

  const columns = columnsFor(from, to)
  const rows = report.data?.results ?? []

  return (
    <>
      <PageHeader
        eyebrow="ANALYTICS"
        title="Filter Report"
        subtitle="Find sites and network codes by traffic source and quality signals. Metrics always reflect the full selected range; the traffic source only decides which earners appear."
        actions={
          <Link href="/reporting" className="secondary-button">
            <ArrowLeft /> Back to reporting
          </Link>
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
        </div>
        <LiveStatus>
          {report.data
            ? `${report.data.total_count} network code${report.data.total_count === 1 ? '' : 's'} match`
            : 'Loading matches'}
        </LiveStatus>
      </FilterRow>

      <FilterRow>
        <Field label="Traffic source" hint="Only earners from this source are listed">
          <Select value={source} onChange={(v) => { setSource(v); setPage(1) }} options={sourceOptions} />
        </Field>
        <Field label="Not applicable %" hint="Show NA share at or above">
          <input
            className="input"
            type="number"
            min={0}
            max={100}
            step="any"
            value={naText}
            placeholder="Any"
            onChange={(e) => { setNaText(e.target.value); setPage(1) }}
          />
        </Field>
        <Field label="iOS %" hint="Show iOS share at or above">
          <input
            className="input"
            type="number"
            min={0}
            max={100}
            step="any"
            value={iosText}
            placeholder="Any"
            onChange={(e) => { setIosText(e.target.value); setPage(1) }}
          />
        </Field>
      </FilterRow>

      <Panel kicker="RESULTS" title="Matching sites and network codes">
        {report.isLoading ? (
          <LoadingRows rows={5} cols={7} />
        ) : report.isError ? (
          <ErrorPanel message="Failed to load filter results." onRetry={() => report.refetch()} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r, i) => r.network_code || String(i)}
              empty="No network codes match these filters."
            />
            <Pagination
              page={report.data?.page ?? page}
              pageSize={PAGE_SIZE}
              count={report.data?.total_count ?? 0}
              onPage={setPage}
            />
          </>
        )}
      </Panel>
    </>
  )
}
