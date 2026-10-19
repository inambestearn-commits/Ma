'use client'

import { useState } from 'react'
import {
  DataTable, ErrorPanel, FilterRow, LoadingRows, PageHeader, Pagination, Panel, SearchField,
  Status, Tabs, type Column,
} from '@/components/kit'
import { usePartnerSites, type PartnerSite } from '@/lib/partner-api'

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const siteColumns: Column<PartnerSite>[] = [
  {
    key: 'domain',
    header: 'Site',
    render: (s) => (
      <div>
        <strong style={{ display: 'block', color: '#3a3a39' }}>{s.domain}</strong>
        <small style={{ color: '#aaa6a0', fontSize: 10 }}>{s.networkCode}</small>
      </div>
    ),
  },
  { key: 'account', header: 'Account', render: (s) => <Status value={s.accountStatus ?? 'unknown'} /> },
  {
    key: 'invitation',
    header: 'Invitation',
    render: (s) => <Status value={s.invitationStatus ?? 'Not invited'} />,
  },
  {
    key: 'approval',
    header: 'Approval',
    render: (s) => (s.approvalStatus ? <Status value={s.approvalStatus} /> : <span>—</span>),
  },
  { key: 'share', header: 'Revenue share', render: (s) => (s.revenueSharePct === null ? '—' : `${s.revenueSharePct}%`) },
  {
    key: 'today',
    header: 'Today',
    render: (s) =>
      s.hasStats ? (
        <div>
          <strong style={{ display: 'block' }}>{money(s.revenue)}</strong>
          <small style={{ color: '#aaa6a0', fontSize: 10 }}>
            {s.impressions.toLocaleString('en-US')} imp
          </small>
        </div>
      ) : (
        <span style={{ color: '#a5a19b', fontSize: 11 }}>No stats yet</span>
      ),
  },
  { key: 'ecpm', header: 'eCPM', render: (s) => (s.hasStats ? money(s.ecpm) : '—') },
]

export default function PartnerSitesPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)

  const sites = usePartnerSites({ search, status, page })
  const counts = sites.data?.counts

  const tabs = [
    { label: 'All', value: 'all', count: counts?.total },
    { label: 'Active', value: 'ACTIVE', count: counts?.active },
    { label: 'Invited', value: 'INVITED', count: counts?.invited },
    { label: 'Inactive', value: 'INACTIVE', count: counts?.inactive },
    { label: 'Declined', value: 'DECLINED', count: counts?.declined },
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
        <PageHeader
          eyebrow="INVENTORY"
          title="My sites"
          subtitle="Every network code assigned to your account."
        />
        <ErrorPanel message={(sites.error as Error).message} onRetry={() => sites.refetch()} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="INVENTORY"
        title="My sites"
        subtitle="Every network code tagged to your account, with today's serving figures where the warehouse has reported them."
      />

      <FilterRow>
        <SearchField value={search} onChange={updateSearch} placeholder="Search sites or network codes" />
      </FilterRow>

      <Tabs tabs={tabs} active={status} onChange={updateStatus} />

      <Panel
        kicker="PUBLISHER SITES"
        title={status === 'all' ? 'All sites' : `${status.charAt(0) + status.slice(1).toLowerCase()} sites`}
        actions={
          <span className="live-status">
            <span className="live-dot" />
            {sites.data ? `${sites.data.count} sites` : 'Loading'}
          </span>
        }
      >
        {sites.isLoading ? (
          <LoadingRows rows={8} cols={7} />
        ) : (
          <>
            <DataTable
              columns={siteColumns}
              rows={sites.data?.results ?? []}
              rowKey={(s) => s.networkCode}
              empty={
                search
                  ? `No sites match “${search}”. Clear the search to see the rest of your inventory.`
                  : 'No sites in this view.'
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
