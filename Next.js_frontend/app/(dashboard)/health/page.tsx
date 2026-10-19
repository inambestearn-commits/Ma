'use client'

import { AlertTriangle, Clock, HeartPulse, Layers, Play, RefreshCw } from 'lucide-react'
import {
  DataTable, LoadingRows, PageHeader, Panel, Pill, StatCard, Status, type Column,
} from '@/components/kit'
import { useHealth } from '@/lib/hooks'
import type { HealthCheck } from '@/lib/data/types'

const stamp = (iso: string) => iso.replace('T', ' ').slice(0, 16)

const healthColumns: Column<HealthCheck>[] = [
  {
    key: 'area',
    header: 'Area',
    render: (h) => <strong style={{ color: '#3a3a39' }}>{h.area}</strong>,
  },
  { key: 'status', header: 'Status', render: (h) => <Status value={h.status} /> },
  { key: 'detail', header: 'Detail', render: (h) => h.detail },
  { key: 'metric', header: 'Metric', render: (h) => <Pill value={h.metric} /> },
  { key: 'checked', header: 'Checked', render: (h) => stamp(h.checked_at) },
]

export default function HealthPage() {
  const { data, isLoading, refetch } = useHealth()
  const checks = data ?? []

  const healthy = checks.filter((c) => c.status === 'Healthy').length
  const degraded = checks.filter((c) => c.status === 'Degraded').length
  const jobs = checks.find((c) => c.area === 'Jobs')
  const api = checks.find((c) => c.area === 'API')
  const database = checks.find((c) => c.area === 'Database')
  const reporting = checks.find((c) => c.area === 'Reporting')
  const first = checks[0]

  const stats = [
    {
      title: 'Overall',
      value: `${healthy}/${checks.length} Healthy`,
      icon: HeartPulse,
      helper: `across ${checks.length} monitored areas`,
    },
    {
      title: 'Degraded areas',
      value: String(degraded),
      icon: AlertTriangle,
      helper: degraded > 0 ? 'needs operator attention' : 'all areas nominal',
    },
    {
      title: 'Last checked',
      value: first ? stamp(first.checked_at) : '—',
      icon: Clock,
      helper: 'scheduled probe · UTC',
    },
    {
      title: 'Jobs queue',
      value: jobs?.metric ?? '—',
      icon: Layers,
      helper: 'scheduler depth · 0 failed',
    },
  ]

  const summaries = [
    { label: 'API p95', row: api },
    { label: 'DB connections', row: database },
    { label: 'Reporting freshness', row: reporting },
  ]

  return (
    <>
      <PageHeader
        eyebrow="OPERATIONS"
        title="System Health"
        subtitle="Sites, MCM, jobs, reporting, revenue, API and database health in one place."
        actions={
          <>
            <button className="secondary-button" type="button" onClick={() => refetch()}>
              <RefreshCw /> Refresh checks
            </button>
            <button className="primary-button" type="button" onClick={() => refetch()}>
              <Play /> Run all checks
            </button>
          </>
        }
      />

      <section className="stats-grid" style={{ marginTop: '26px' }} aria-label="Health summary">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div className="stat-card" key={i}>
              <LoadingRows rows={1} cols={1} />
            </div>
          ))
        ) : (
          stats.map((s) => <StatCard key={s.title} {...s} />)
        )}
      </section>

      <Panel kicker="HEALTH AREAS" title="Subsystem status" className="partners-panel">
        {isLoading ? (
          <LoadingRows rows={7} cols={5} />
        ) : (
          <DataTable columns={healthColumns} rows={checks} rowKey={(h) => h.area} />
        )}
      </Panel>

      <section className="detail-grid-3" aria-label="Key service metrics">
        {isLoading ? (
          <LoadingRows rows={1} cols={3} />
        ) : (
          summaries.map((item) => (
            <div className="metric" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.row?.metric ?? '—'}</strong>
              <small>{item.row?.detail ?? 'no check returned for this area'}</small>
            </div>
          ))
        )}
      </section>

      <p className="form-note">
        Each probe in §19 is re-run on a schedule and stamped with its check time: inventory counts
        and withdrawal ratio for Sites, adapter status sync for MCM, queue depth and failures for
        Jobs, ingestion and reconciliation for Reporting, unreconciled batches for Revenue, latency
        and error rate for API, and connections and backups for the database. The degraded MCM-002
        entry is configuration-only multi-MCM readiness — its adapter is disabled and no relationship,
        invite or reporting behaviour is affected (BR-012, §32).
      </p>
    </>
  )
}
