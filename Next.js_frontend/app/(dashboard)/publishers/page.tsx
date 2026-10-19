'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Boxes, CircleAlert, Clock, Download, Plus, Users } from 'lucide-react'
import {
  DataTable, DateSelector, FilterRow, KeyValue, LiveStatus, LoadingRows, Modal, PageHeader,
  Pagination, Panel, Pill, SearchField, StatCard, Status, Tabs, type Column,
} from '@/components/kit'
import { useSites } from '@/lib/hooks'
import type { PublisherSite } from '@/lib/data/types'

const SCOPE = 'AGX-1001'

interface TabDef {
  label: string
  value: string
  status?: string
  apiError?: boolean
}

const tabDefs: TabDef[] = [
  { label: 'All', value: 'all' },
  { label: 'Accepted', value: 'accepted', status: 'ACCEPTED' },
  { label: 'Pending', value: 'pending', status: 'PENDING' },
  { label: 'Withdrawal', value: 'withdrawal', status: 'WITHDRAWN' },
  { label: 'Declined', value: 'declined', status: 'DECLINED' },
  { label: 'Closed', value: 'closed', status: 'CLOSED' },
  { label: 'Expired', value: 'expired', status: 'EXPIRED' },
  { label: 'API Error', value: 'api-error', apiError: true },
]

type Action = 'share' | 'withdraw' | 'reinvite'

const actionCopy: Record<Action, { title: string; copy: string; confirm: string }> = {
  share: {
    title: 'Change revenue share',
    copy:
      'Revenue share is stored as a formal rule. Effective dating keeps historical revenue with the relationship it was earned under (BR-006, BR-007).',
    confirm: 'Save share change',
  },
  withdraw: {
    title: 'Withdraw publisher',
    copy:
      'Withdrawal creates lifecycle history rather than overwriting the past state (BR-008). The publisher is removed from your active scope and can be re-invited later.',
    confirm: 'Confirm withdrawal',
  },
  reinvite: {
    title: 'Re-invite publisher',
    copy: 'Creates a new invite version with its own audit event and external reference (BR-008).',
    confirm: 'Send re-invite',
  },
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase()
}

function publisherColumns(onAction: (action: Action, row: PublisherSite) => void): Column<PublisherSite>[] {
  return [
    {
      key: 'publisher',
      header: 'Publisher',
      render: (s) => (
        <div>
          <span style={{ display: 'block', fontSize: 10, color: '#a5a19b' }}>{s.publisher_ticket}</span>
          <strong style={{ color: '#3a3a39' }}>{s.site}</strong>
        </div>
      ),
    },
    { key: 'share', header: 'Revenue share', render: (s) => `${s.revenue_share}%` },
    { key: 'gmail', header: 'Gmail', render: (s) => s.publisher_email },
    { key: 'network', header: 'Network', render: (s) => <Pill value={s.network_code} /> },
    { key: 'status', header: 'Status', render: (s) => <Status value={titleCase(s.status)} /> },
    { key: 'api', header: 'API', render: (s) => <Status value={s.api_status.replace('_', ' ')} /> },
    { key: 'onboarding', header: 'Onboarding', render: (s) => s.onboarding_date },
    { key: 'updated', header: 'Updated', render: (s) => s.updated_at },
    {
      key: 'actions',
      header: 'Actions',
      render: (s) => (
        <div className="table-actions" onClick={(e) => e.stopPropagation()}>
          <button className="secondary-button" type="button" onClick={() => onAction('share', s)}>
            Change share
          </button>
          <button className="secondary-button" type="button" onClick={() => onAction('withdraw', s)}>
            Withdraw
          </button>
          <button className="secondary-button" type="button" onClick={() => onAction('reinvite', s)}>
            Re-invite
          </button>
        </div>
      ),
    },
  ]
}

export default function PublishersPage() {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('all')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<{ action: Action; site: PublisherSite } | null>(null)

  const sites = useSites({ search, page_size: 100 })

  const loaded = (sites.data?.results ?? []).filter((s) => s.partner_ticket === SCOPE)
  const activeDef = tabDefs.find((t) => t.value === tab) ?? tabDefs[0]
  const rows = loaded.filter(
    (s) =>
      (!activeDef.status || s.status === activeDef.status) &&
      (!activeDef.apiError || s.api_status === 'API_ERROR'),
  )

  const counts: Record<string, number> = { all: loaded.length }
  for (const def of tabDefs) {
    counts[def.value] = loaded.filter(
      (s) => (!def.status || s.status === def.status) && (!def.apiError || s.api_status === 'API_ERROR'),
    ).length
  }

  const total = loaded.length
  const active = loaded.filter((s) => s.status === 'ACTIVE').length
  const pending = loaded.filter((s) => s.status === 'PENDING' || s.status === 'INVITED').length
  const apiErrors = loaded.filter((s) => s.api_status === 'API_ERROR').length

  const pageSize = 25
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pagedRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const tabs = tabDefs.map((def) => ({
    label: def.label,
    value: def.value,
    count: sites.isLoading ? undefined : counts[def.value],
  }))

  const columns = publisherColumns((action, site) => setModal({ action, site }))
  const modalCopy = modal ? actionCopy[modal.action] : null

  function updateSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  return (
    <>
      <PageHeader
        eyebrow="PUBLISHERS"
        title="Manage publishers"
        subtitle="Onboard, withdraw and re-invite publishers inside your AGX-1001 scope. Another partner's inventory is never visible here (BR-002, BR-004)."
        actions={
          <>
            <Link className="primary-button" href="/publishers/new">
              <Plus /> Add publisher
            </Link>
            <button className="secondary-button" type="button">
              <Download /> Export
            </button>
          </>
        }
      />

      <FilterRow>
        <SearchField value={search} onChange={updateSearch} placeholder="Search site, ticket or Gmail" />
        <DateSelector
          label="All time"
          options={['All time', 'Last 7 days', 'Last 30 days', 'Quarter to date', 'Year to date']}
        />
        <LiveStatus>
          {sites.isLoading
            ? 'Loading your scope…'
            : `${total} publishers · ${active} active · ${apiErrors} API errors`}
        </LiveStatus>
      </FilterRow>

      <Tabs tabs={tabs} active={tab} onChange={(value) => { setTab(value); setPage(1) }} />

      <section className="stats-grid" aria-label="Publisher summary">
        {sites.isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div className="stat-card" key={i}>
                <LoadingRows rows={1} cols={1} />
              </div>
            ))
          : (
              <>
                <StatCard title="Total publishers" value={String(total)} icon={Boxes} helper="inside the AGX-1001 scope" />
                <StatCard title="Active" value={String(active)} icon={Users} helper="serving ads today" />
                <StatCard title="Pending invites" value={String(pending)} icon={Clock} helper="awaiting publisher response" />
                <StatCard title="API errors" value={String(apiErrors)} icon={CircleAlert} negative helper="needs an MCM sync check" />
              </>
            )}
      </section>

      <Panel kicker="PUBLISHER DIRECTORY" title="Publishers in scope" className="partners-panel">
        {sites.isLoading ? (
          <LoadingRows rows={6} cols={9} />
        ) : (
          <DataTable
            columns={columns}
            rows={pagedRows}
            rowKey={(s) => s.id}
            empty="No publishers in this view. Switch the tab or clear the search to see the rest of your AGX-1001 scope."
          />
        )}

        {sites.isLoading ? null : (
          <Pagination page={currentPage} pageSize={pageSize} count={rows.length} onPage={setPage} />
        )}
      </Panel>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modalCopy?.title ?? ''}
        copy={modalCopy?.copy}
        actions={
          <>
            <button className="secondary-button" type="button" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button className="primary-button" type="button" onClick={() => setModal(null)}>
              {modalCopy?.confirm ?? 'Confirm'}
            </button>
          </>
        }
      >
        {modal ? (
          <KeyValue
            items={[
              { label: 'Publisher', value: modal.site.site },
              { label: 'Publisher ticket', value: modal.site.publisher_ticket },
              { label: 'Current share', value: `${modal.site.revenue_share}%` },
            ]}
          />
        ) : null}
      </Modal>
    </>
  )
}
