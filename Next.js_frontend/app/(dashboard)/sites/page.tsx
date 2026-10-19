'use client'

import { useState } from 'react'
import {
  DataTable, FilterRow, LoadingRows, PageHeader, Pagination, Panel, Pill, SearchField, Status,
  Tabs, type Column,
} from '@/components/kit'
import { useManagePublishers } from '@/lib/hooks'
import type { ManagePublisherCounts, ManagePublisherRow } from '@/lib/api'
import { displayDomain } from '@/lib/label'

function titleCase(value: string) {
  return value ? value.charAt(0) + value.slice(1).toLowerCase() : '—'
}

/** `revenue_share_millipercent` is thousandths of a percent: 10000 = 10%. */
function sharePct(millipercent: number | null): string {
  if (millipercent === null) return '—'
  return `${Math.round((millipercent / 1000) * 10) / 10}%`
}

/**
 * Same column set as the partner publishers page (/p/publishers): publisher
 * identity, network code, email, revenue share, invitation/approval lifecycle,
 * delegation and child publisher ID.
 */
const publisherColumns: Column<ManagePublisherRow>[] = [
  {
    key: 'publisher',
    header: 'Publisher',
    render: (s) => (
      <div>
        <strong style={{ display: 'block', color: '#3a3a39' }}>{displayDomain(s.label ?? '')}</strong>
        <small style={{ color: '#aaa6a0', fontSize: 10 }}>{s.label ?? '—'}</small>
      </div>
    ),
  },
  { key: 'network', header: 'Network code', render: (s) => <Pill value={s.network_code} /> },
  { key: 'email', header: 'Email', render: (s) => s.email ?? '—' },
  { key: 'share', header: 'Revenue share', render: (s) => sharePct(s.revenue_share_millipercent) },
  {
    key: 'invitation',
    header: 'Invitation',
    render: (s) => (s.invitation_status ? <Status value={titleCase(s.invitation_status)} /> : '—'),
  },
  {
    key: 'approval',
    header: 'Approval',
    render: (s) => (s.approval_status ? <Status value={titleCase(s.approval_status)} /> : '—'),
  },
  { key: 'delegation', header: 'Delegation', render: (s) => s.delegation_type ?? '—' },
  { key: 'child', header: 'Child publisher ID', render: (s) => s.child_publisher_id ?? '—' },
]

/**
 * Status tabs backed by the backend's own buckets (the `counts` object of
 * GET /api/v1/publishers/manage/) — the same tab pattern as the partner
 * publishers page, with the admin-grade lifecycle buckets.
 */
const STATUS_TABS: { label: string; key: keyof ManagePublisherCounts }[] = [
  { label: 'All', key: 'all' },
  { label: 'Approved', key: 'approved' },
  { label: 'Pending', key: 'pending' },
  { label: 'Invited', key: 'invited' },
  { label: 'Withdrawal by child', key: 'withdrawal_by_child' },
  { label: 'Withdrawn', key: 'withdrawn' },
  { label: 'Policy', key: 'policy' },
  { label: 'IVT', key: 'ivt' },
  { label: 'Not approved', key: 'not_approved' },
  { label: 'Inactive', key: 'inactive' },
]

export default function SitesPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)

  const publishers = useManagePublishers({ search, status, page, page_size: 25 })
  const counts = publishers.data?.counts

  const tabs = STATUS_TABS.map((t) => ({ label: t.label, value: t.key, count: counts?.[t.key] }))

  function updateSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function updateStatus(value: string) {
    setStatus(value)
    setPage(1)
  }

  if (publishers.isError) {
    return (
      <>
        <PageHeader
          eyebrow="INVENTORY"
          title="Publishers"
          subtitle="Every GAM child publisher across all partners."
        />
        <div className="form-note" role="alert">
          {(publishers.error as Error).message}
          &nbsp;
          <button className="text-button" type="button" onClick={() => publishers.refetch()}>
            Retry
          </button>
        </div>
      </>
    )
  }

  const activeLabel = STATUS_TABS.find((t) => t.key === status)?.label ?? 'All'

  return (
    <>
      <PageHeader
        eyebrow="INVENTORY"
        title="Publishers"
        subtitle="Every GAM child publisher across all partners, with its invitation and approval lifecycle. Accept, withdraw and re-invite actions are processed by the operations team."
      />

      <FilterRow>
        <SearchField
          value={search}
          onChange={updateSearch}
          placeholder="Search network codes, names or labels"
        />
      </FilterRow>

      <Tabs tabs={tabs} active={status} onChange={updateStatus} />

      <Panel
        kicker="PUBLISHER SITES"
        title={`${activeLabel} publishers`}
        actions={
          <span className="live-status">
            <span className="live-dot" />
            {publishers.data ? `${publishers.data.total_count} sites` : 'Loading'}
          </span>
        }
      >
        {publishers.isLoading && !publishers.data ? (
          <LoadingRows rows={8} cols={8} />
        ) : (
          <>
            <DataTable
              columns={publisherColumns}
              rows={publishers.data?.results ?? []}
              rowKey={(s) => s.network_code}
              empty={
                search
                  ? `No sites match “${search}”. Clear the search to see the rest of the publishers.`
                  : 'No publishers in this view.'
              }
            />
            {publishers.data ? (
              <Pagination
                page={publishers.data.page}
                pageSize={publishers.data.page_size}
                count={publishers.data.total_count}
                onPage={setPage}
              />
            ) : null}
          </>
        )}
      </Panel>
    </>
  )
}
