'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import {
  DataTable, ErrorPanel, FilterRow, LoadingRows, PageHeader, Pagination, Panel, Pill,
  SearchField, Select, Status, Tabs, type Column,
} from '@/components/kit'
import { usePartnerTickets, type PartnerTicket } from '@/lib/partner-api'
import {
  CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS,
  TICKET_CATEGORIES, type TicketCategory,
} from '@/lib/tickets'
import { formatUtcCompact } from '@/lib/date'

const columns: Column<PartnerTicket>[] = [
  {
    key: 'ticket',
    header: 'Ticket',
    render: (t) => (
      <div>
        <strong style={{ display: 'block', color: '#3a3a39' }}>{t.subject}</strong>
        <small style={{ color: '#aaa6a0', fontSize: 10 }}>
          {t.ticketId} · {t.messageCount} {t.messageCount === 1 ? 'message' : 'messages'}
        </small>
      </div>
    ),
  },
  {
    key: 'category',
    header: 'Category',
    render: (t) => <Pill value={CATEGORY_LABELS[t.category as TicketCategory] ?? t.category} />,
  },
  { key: 'priority', header: 'Priority', render: (t) => PRIORITY_LABELS[t.priority as never] ?? t.priority },
  {
    key: 'status',
    header: 'Status',
    render: (t) => <Status value={STATUS_LABELS[t.status as never] ?? t.status} />,
  },
  {
    key: 'updated',
    header: 'Updated',
    render: (t) => formatUtcCompact(t.lastMessageAt ?? t.updatedAt),
  },
  {
    key: 'assigned',
    header: 'Assigned to',
    render: (t) => t.assignedTo ?? <span style={{ color: '#a5a19b', fontSize: 11 }}>Unassigned</span>,
  },
]

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All categories' },
  ...TICKET_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
]

export default function PartnerTicketsPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')
  const [page, setPage] = useState(1)

  const tickets = usePartnerTickets({ search, status, category, page })
  const counts = tickets.data?.counts

  const tabs = [
    { label: 'All', value: 'all', count: counts?.total },
    { label: 'Open', value: 'OPEN', count: counts?.open },
    { label: 'In progress', value: 'IN_PROGRESS', count: counts?.inProgress },
    { label: 'Waiting on you', value: 'WAITING', count: counts?.waiting },
    { label: 'Resolved', value: 'RESOLVED', count: counts?.resolved },
    { label: 'Closed', value: 'CLOSED', count: counts?.closed },
  ]

  const activeCount = counts?.active ?? 0

  if (tickets.isError) {
    return (
      <>
        <PageHeader
          eyebrow="SUPPORT"
          title="Support tickets"
          subtitle="Track conversations with the AdGlobeX support team."
        />
        <ErrorPanel message={(tickets.error as Error).message} onRetry={() => tickets.refetch()} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="SUPPORT"
        title="Support tickets"
        subtitle="Every ticket your account has filed, with the full conversation and its status. Tickets are linked to your partner tag, so only your account can see them."
        actions={
          <Link className="primary-button" href="/p/tickets/new">
            <Plus /> New ticket
          </Link>
        }
      />

      <FilterRow>
        <SearchField
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search by subject or ticket ID"
        />
        <Select
          value={category}
          onChange={(v) => {
            setCategory(v)
            setPage(1)
          }}
          options={CATEGORY_OPTIONS}
        />
      </FilterRow>

      <Tabs
        tabs={tabs}
        active={status}
        onChange={(v) => {
          setStatus(v)
          setPage(1)
        }}
      />

      <Panel
        kicker="TICKETS"
        title={status === 'all' ? 'All tickets' : STATUS_LABELS[status as never] ?? status}
        actions={
          <span className="live-status">
            <span className="live-dot" />
            {tickets.data
              ? activeCount > 0
                ? `${activeCount} awaiting a reply`
                : `${tickets.data.counts.total} total`
              : 'Loading'}
          </span>
        }
      >
        {tickets.isLoading ? (
          <LoadingRows rows={6} cols={6} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={tickets.data?.results ?? []}
              rowKey={(t) => t.ticketId}
              onRowClick={(t) => router.push(`/p/tickets/${encodeURIComponent(t.ticketId)}`)}
              empty={
                search
                  ? `No tickets match “${search}”. Clear the search to see the rest.`
                  : status === 'all'
                    ? 'You have not filed a ticket yet. Use “New ticket” to ask for help with billing, technical issues or your account.'
                    : 'No tickets in this view.'
              }
            />
            {tickets.data ? (
              <Pagination
                page={tickets.data.page}
                pageSize={tickets.data.page_size}
                count={tickets.data.count}
                onPage={setPage}
              />
            ) : null}
          </>
        )}
      </Panel>
    </>
  )
}
