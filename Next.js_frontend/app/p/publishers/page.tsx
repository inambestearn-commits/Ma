'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import {
  DataTable, FilterRow, LoadingRows, PageHeader, Pagination, Panel, Pill, SearchField, Status,
  Tabs, type Column,
} from '@/components/kit'
import { usePartnerSites, type PartnerSite } from '@/lib/partner-api'

function titleCase(value: string) {
  return value ? value.charAt(0) + value.slice(1).toLowerCase() : '—'
}

const publisherColumns: Column<PartnerSite>[] = [
  {
    key: 'publisher',
    header: 'Publisher',
    render: (s) => (
      <div>
        <strong style={{ display: 'block', color: '#3a3a39' }}>{s.domain}</strong>
        <small style={{ color: '#aaa6a0', fontSize: 10 }}>{s.label}</small>
      </div>
    ),
  },
  { key: 'network', header: 'Network code', render: (s) => <Pill value={s.networkCode} /> },
  { key: 'email', header: 'Email', render: (s) => s.email ?? '—' },
  {
    key: 'share',
    header: 'Revenue share',
    render: (s) => (s.revenueSharePct === null ? '—' : `${s.revenueSharePct}%`),
  },
  { key: 'invitation', header: 'Invitation', render: (s) => (s.invitationStatus ? <Status value={titleCase(s.invitationStatus)} /> : '—') },
  { key: 'approval', header: 'Approval', render: (s) => (s.approvalStatus ? <Status value={titleCase(s.approvalStatus)} /> : '—') },
  { key: 'delegation', header: 'Delegation', render: (s) => s.delegationType ?? '—' },
  { key: 'id', header: 'Child publisher ID', render: (s) => s.childPublisherId ?? '—' },
]

export default function PartnerPublishersPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)

  const sites = usePartnerSites({ search, status, page, facet: 'invitation' })
  const counts = sites.data?.counts

  const tabs = [
    { label: 'All', value: 'all', count: counts?.total },
    { label: 'Accepted', value: 'ACCEPTED', count: counts?.accepted },
    { label: 'Pending', value: 'PENDING', count: counts?.pending },
    { label: 'Withdrawn', value: 'WITHDRAWN', count: counts?.withdrawn },
    { label: 'Rejected', value: 'REJECTED', count: counts?.rejected },
  ]

  function updateSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function updateStatus(value: string) {
    setStatus(value)
    setPage(1)
  }

  if (sites.isError) {
    return (
      <>
        <PageHeader eyebrow="INVENTORY" title="Publishers" subtitle="Sites in your partner scope." />
        <div className="form-note" role="alert">
          {(sites.error as Error).message}
          &nbsp;
          <button className="text-button" type="button" onClick={() => sites.refetch()}>
            Retry
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="INVENTORY"
        title="Publishers"
        subtitle="Every site in your partner scope, with its invitation lifecycle. Accept, withdraw and re-invite actions are processed by the operations team."
        actions={
          <Link className="primary-button" href="/p/publishers/new">
            <Plus /> Add publisher
          </Link>
        }
      />

      <FilterRow>
        <SearchField value={search} onChange={updateSearch} placeholder="Search sites or network codes" />
      </FilterRow>

      <Tabs tabs={tabs} active={status} onChange={updateStatus} />

      <Panel
        kicker="PUBLISHER SITES"
        title={status === 'all' ? 'All publishers' : `${status.charAt(0)}${status.slice(1).toLowerCase()} publishers`}
        actions={
          <span className="live-status">
            <span className="live-dot" />
            {sites.data ? `${sites.data.count} sites` : 'Loading'}
          </span>
        }
      >
        {sites.isLoading && !sites.data ? (
          <LoadingRows rows={8} cols={8} />
        ) : (
          <>
            <DataTable
              columns={publisherColumns}
              rows={sites.data?.results ?? []}
              rowKey={(s) => s.networkCode}
              empty={
                search
                  ? `No sites match “${search}”. Clear the search to see the rest of your publishers.`
                  : 'No publishers in this view.'
              }
            />
            {sites.data ? (
              <Pagination
                page={sites.data.page}
                pageSize={sites.data.page_size}
                count={sites.data.count}
                onPage={setPage}
              />
            ) : null}
          </>
        )}
      </Panel>
    </>
  )
}
