'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Download, Plus } from 'lucide-react'
import {
  DataTable, FilterRow, LiveStatus, LoadingRows, PageHeader, Pagination, SearchField, Select,
  Status, type Column,
} from '@/components/kit'
import { usePartners } from '@/lib/hooks'
import type { Partner } from '@/lib/data/types'

const partColors = ['bg-[#ff875f]', 'bg-[#75b6c8]', 'bg-[#d99a67]', 'bg-[#a58fca]', 'bg-[#82b995]']

const statusOptions = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'ACTIVE' },
  { value: 'SUSPENDED', label: 'SUSPENDED' },
  { value: 'DISABLED', label: 'DISABLED' },
  { value: 'CLOSED', label: 'CLOSED' },
]

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

function avatarTone(ticket: string) {
  const score = ticket.split('').reduce((total, ch) => total + ch.charCodeAt(0), 0)
  return partColors[score % partColors.length]
}

const partnerColumns: Column<Partner>[] = [
  {
    key: 'partner',
    header: 'Partner',
    render: (p) => (
      <div className="partner-cell">
        <div className={`partner-avatar ${avatarTone(p.partner_ticket)}`}>{initials(p.name)}</div>
        <div>
          <strong>{p.name}</strong>
          <span>Partner ID: {p.partner_ticket}</span>
        </div>
      </div>
    ),
  },
  { key: 'type', header: 'Type', render: (p) => p.type },
  {
    key: 'contact',
    header: 'Contact',
    render: (p) => (
      <div>
        <strong style={{ display: 'block', color: '#3a3a39' }}>{p.contact_name}</strong>
        <small style={{ color: '#aaa6a0', fontSize: 10 }}>{p.contact_email}</small>
      </div>
    ),
  },
  { key: 'sites', header: 'Sites', render: (p) => `${p.active_sites} / ${p.sites}` },
  { key: 'share', header: 'Revenue share', render: (p) => `${p.revenue_share}%` },
  { key: 'revenue', header: 'Revenue', render: (p) => `$${p.revenue.toLocaleString('en-US')}` },
  { key: 'status', header: 'Status', render: (p) => <Status value={p.status} /> },
]

export default function PartnersPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const partners = usePartners({ search, status, page, page_size: 10 })

  const rows = partners.data?.results ?? []
  const count = partners.data?.count ?? 0
  const activeCount = rows.filter((p) => p.status === 'ACTIVE').length

  function updateSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function updateStatus(value: string) {
    setStatus(value)
    setPage(1)
  }

  return (
    <>
      <PageHeader
        eyebrow="PARTNER DIRECTORY"
        title="Partners"
        subtitle="Manage tenants, roles, commercial terms and account health."
        actions={
          <>
            <Link className="primary-button" href="/partners/new">
              <Plus /> Create partner
            </Link>
            <button className="secondary-button" type="button">
              <Download /> Export
            </button>
          </>
        }
      />

      <FilterRow>
        <SearchField value={search} onChange={updateSearch} placeholder="Search name, ticket or contact" />
        <div style={{ width: 178 }}>
          <Select value={status} onChange={updateStatus} options={statusOptions} />
        </div>
        <LiveStatus>
          {partners.isLoading ? 'Loading directory…' : `${count} partners · ${activeCount} active`}
        </LiveStatus>
      </FilterRow>

      <section className="panel partners-panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">DIRECTORY</p>
            <h2>All partners</h2>
          </div>
          <div className="table-actions">
            <span className="field-hint">Select a row to open the partner record</span>
          </div>
        </div>

        {partners.isLoading ? (
          <LoadingRows rows={6} cols={7} />
        ) : (
          <DataTable
            columns={partnerColumns}
            rows={rows}
            rowKey={(p) => p.id}
            onRowClick={(p) => router.push(`/partners/${p.id}`)}
            empty="No partners match this search. Clear the filters to see the full directory."
          />
        )}

        {partners.isLoading ? null : (
          <Pagination page={page} pageSize={10} count={count} onPage={setPage} />
        )}
      </section>
    </>
  )
}
