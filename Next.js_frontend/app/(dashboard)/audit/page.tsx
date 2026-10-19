'use client'

import { useState } from 'react'
import { Download, ScrollText } from 'lucide-react'
import {
  DataTable, EmptyView, FilterRow, LiveStatus, LoadingRows, PageHeader, Pagination, Panel,
  Pill, SearchField, Select, type Column,
} from '@/components/kit'
import { useAudit } from '@/lib/hooks'
import type { AuditEvent } from '@/lib/data/types'

const stamp = (iso: string) => iso.replace('T', ' ').slice(0, 16)

const auditColumns: Column<AuditEvent>[] = [
  { key: 'time', header: 'Time', render: (a) => stamp(a.timestamp) },
  { key: 'action', header: 'Action', render: (a) => <Pill value={a.action} /> },
  {
    key: 'actor',
    header: 'Actor',
    render: (a) => (
      <div>
        <strong style={{ display: 'block', color: '#3a3a39' }}>{a.actor}</strong>
        <small style={{ color: '#aaa6a0', fontSize: 10 }}>{a.actor_role}</small>
      </div>
    ),
  },
  {
    key: 'target',
    header: 'Target',
    render: (a) => (
      <div>
        <strong style={{ display: 'block', color: '#3a3a39' }}>{a.target_type}</strong>
        <small style={{ color: '#aaa6a0', fontSize: 10 }}>{a.target_id}</small>
      </div>
    ),
  },
  { key: 'description', header: 'Description', render: (a) => a.description },
  {
    key: 'state',
    header: 'State',
    render: (a) => `${a.previous_state ?? '—'} → ${a.new_state ?? '—'}`,
  },
  {
    key: 'partner',
    header: 'Partner',
    render: (a) => (a.partner_ticket ? <Pill value={a.partner_ticket} /> : '—'),
  },
]

export default function AuditPage() {
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('all')
  const [page, setPage] = useState(1)

  const catalog = useAudit({ page_size: 100 })
  const events = useAudit({
    search,
    status: action === 'all' ? undefined : action,
    page,
    page_size: 25,
  })

  const knownActions = Array.from(new Set((catalog.data?.results ?? []).map((a) => a.action))).sort()
  const actionOptions = [
    { value: 'all', label: 'All actions' },
    ...knownActions.map((value) => ({ value, label: value })),
  ]
  const rows = events.data?.results ?? []

  const changeSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const changeAction = (value: string) => {
    setAction(value)
    setPage(1)
  }

  return (
    <>
      <PageHeader
        eyebrow="GOVERNANCE"
        title="Audit Log"
        subtitle="Append-only record of lifecycle, financial, security and configuration actions. Corrections create new events — old records are never edited (BR-011)."
        actions={
          <button className="secondary-button" type="button">
            <Download /> Export
          </button>
        }
      />

      <FilterRow>
        <SearchField
          value={search}
          onChange={changeSearch}
          placeholder="Search action, actor or target"
        />
        <Select value={action} onChange={changeAction} options={actionOptions} />
        <LiveStatus>Append-only record</LiveStatus>
      </FilterRow>

      <p className="form-note">
        Every entry captures the six fields §18 requires: actor, object, action, time, previous state
        and new state — plus the actor role, the free-text description and the partner ticket when
        the change touches a relationship. Corrections are appended as new events; an existing
        record is never rewritten (BR-011).
      </p>

      <Panel kicker="EVENTS" title="Recorded actions" className="partners-panel">
        {events.isLoading ? (
          <LoadingRows rows={6} cols={7} />
        ) : rows.length === 0 ? (
          <EmptyView
            title="No audit events match this search"
            description="No recorded action matches the current search and action filter. Clear the filters to review the full append-only trail."
            icon={ScrollText}
            action="Clear filters"
            onAction={() => {
              setSearch('')
              setAction('all')
            }}
          />
        ) : (
          <>
            <DataTable columns={auditColumns} rows={rows} rowKey={(a) => a.id} />
            <Pagination
              page={page}
              pageSize={25}
              count={events.data?.count ?? 0}
              onPage={setPage}
            />
          </>
        )}
      </Panel>
    </>
  )
}
