'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  DataTable, ErrorPanel, Field, FilterRow, KeyValue, LoadingRows, Modal, PageHeader, Pagination,
  Panel, Pill, SearchField, Select, Status, Tabs, type Column,
} from '@/components/kit'
import { usePartners, useSupportTicket, useSupportTickets } from '@/lib/hooks'
import { createSupportTicket, type SupportTicketRow } from '@/lib/api'
import {
  CATEGORY_LABELS, PRIORITY_LABELS, TICKET_CATEGORIES, TICKET_PRIORITIES,
  type TicketCategory,
} from '@/lib/tickets'
import { formatUtcCompact } from '@/lib/date'

/**
 * Admin vocabulary — same keys as the partner portal's shared STATUS_LABELS,
 * except WAITING reads "Waiting on partner" here: from the staff side the
 * publisher is the one being waited on.
 */
const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING: 'Waiting on partner',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
}

/**
 * Partner-parity columns (subject, category, priority, status, updated,
 * assigned) plus the two fields only staff need: which partner filed it and
 * who at that partner wrote in.
 */
const columns: Column<SupportTicketRow>[] = [
  {
    key: 'ticket',
    header: 'Ticket',
    render: (t) => (
      <div>
        <strong style={{ display: 'block', color: '#3a3a39' }}>{t.subject}</strong>
        <small style={{ color: '#aaa6a0', fontSize: 10 }}>
          {t.ticket_id} · {t.message_count} {t.message_count === 1 ? 'message' : 'messages'}
        </small>
      </div>
    ),
  },
  {
    key: 'partner',
    header: 'Partner',
    render: (t) => <Pill value={t.partner_tag.toUpperCase()} />,
  },
  {
    key: 'requester',
    header: 'Requester',
    render: (t) => t.created_by_name || t.created_by_email || '—',
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
    render: (t) => <Status value={STATUS_LABELS[t.status] ?? t.status} />,
  },
  {
    key: 'updated',
    header: 'Updated',
    render: (t) => formatUtcCompact(t.last_message_at ?? t.updated_at),
  },
  {
    key: 'assigned',
    header: 'Assigned to',
    render: (t) => t.assigned_to ?? <span style={{ color: '#a5a19b', fontSize: 11 }}>Unassigned</span>,
  },
]

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All categories' },
  ...TICKET_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
]

export default function SupportPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('all')
  const [page, setPage] = useState(1)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [partner, setPartner] = useState('')
  const [newCategory, setNewCategory] = useState<string>('TECHNICAL')
  const [newPriority, setNewPriority] = useState('NORMAL')
  const [message, setMessage] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const tickets = useSupportTickets({ search, status, category, page })
  const counts = tickets.data?.counts
  const detail = useSupportTicket(selectedId)
  const partners = usePartners({ page_size: 100 })

  const partnerOptions = (partners.data?.results ?? []).map((p) => ({
    value: p.partner_ticket,
    label: `${p.partner_ticket} · ${p.name}`,
  }))

  const tabs = [
    { label: 'All', value: 'all', count: counts?.total },
    { label: 'Open', value: 'OPEN', count: counts?.open },
    { label: 'In progress', value: 'IN_PROGRESS', count: counts?.in_progress },
    { label: 'Waiting on partner', value: 'WAITING', count: counts?.waiting },
    { label: 'Resolved', value: 'RESOLVED', count: counts?.resolved },
    { label: 'Closed', value: 'CLOSED', count: counts?.closed },
  ]

  const activeCount = counts?.active ?? 0
  const ticket = detail.data?.ticket ?? null
  const messages = detail.data?.messages ?? []

  function resetComposer() {
    setComposerOpen(false)
    setSubject('')
    setPartner('')
    setNewCategory('TECHNICAL')
    setNewPriority('NORMAL')
    setMessage('')
    setSubmitError(null)
  }

  async function submitTicket() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await createSupportTicket({
        partner_tag: partner || partnerOptions[0]?.value || '',
        subject,
        description: message,
        category: newCategory,
        priority: newPriority,
      })
      resetComposer()
      tickets.refetch()
    } catch (e) {
      setSubmitError((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  if (tickets.isError) {
    return (
      <>
        <PageHeader
          eyebrow="SUPPORT"
          title="Support tickets"
          subtitle="Tickets filed by partners across every account."
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
        subtitle="Every ticket any partner has filed, with the full conversation and its status. Staff can file on a partner's behalf; replies from the partner reopen resolved threads."
        actions={
          <button className="primary-button" type="button" onClick={() => setComposerOpen(true)}>
            <Plus /> New ticket
          </button>
        }
      />

      <FilterRow>
        <SearchField
          value={search}
          onChange={(v) => {
            setSearch(v)
            setPage(1)
          }}
          placeholder="Search subject, ticket ID, partner or requester"
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
        title={status === 'all' ? 'All tickets' : STATUS_LABELS[status] ?? status}
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
          <LoadingRows rows={6} cols={8} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={tickets.data?.results ?? []}
              rowKey={(t) => t.ticket_id}
              onRowClick={(t) => setSelectedId(t.ticket_id)}
              empty={
                search
                  ? `No tickets match “${search}”. Clear the search to see the rest.`
                  : status === 'all' && category === 'all'
                    ? 'No tickets in the queue. Tickets filed by partners — or by staff on their behalf — appear here.'
                    : 'No tickets in this view.'
              }
            />
            {tickets.data ? (
              <Pagination
                page={tickets.data.page}
                pageSize={tickets.data.page_size}
                count={tickets.data.total_count}
                onPage={setPage}
              />
            ) : null}
          </>
        )}
      </Panel>

      <Modal
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        title={ticket ? ticket.subject : 'Loading ticket…'}
        copy={ticket ? `${ticket.ticket_id} · ${ticket.partner_tag.toUpperCase()}` : undefined}
        actions={
          <button className="secondary-button" type="button" onClick={() => setSelectedId(null)}>
            Close
          </button>
        }
      >
        {detail.isLoading ? (
          <LoadingRows rows={4} cols={2} />
        ) : ticket ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <KeyValue
              items={[
                { label: 'Partner', value: ticket.partner_tag.toUpperCase() },
                {
                  label: 'Requester',
                  value: ticket.created_by_name || ticket.created_by_email || '—',
                },
                { label: 'Category', value: CATEGORY_LABELS[ticket.category as TicketCategory] ?? ticket.category },
                { label: 'Priority', value: PRIORITY_LABELS[ticket.priority as never] ?? ticket.priority },
                { label: 'Status', value: <Status value={STATUS_LABELS[ticket.status] ?? ticket.status} /> },
                { label: 'Assigned to', value: ticket.assigned_to ?? 'Unassigned' },
                { label: 'Created', value: formatUtcCompact(ticket.created_at) },
                { label: 'Updated', value: formatUtcCompact(ticket.updated_at) },
              ]}
            />
            <div>
              <p className="panel-kicker" style={{ marginBottom: 10 }}>CONVERSATION</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.map((m) => (
                  <div
                    key={m.message_id}
                    style={{
                      border: '1px solid #e8e4de',
                      borderRadius: 8,
                      padding: '10px 12px',
                      background: m.sender_type === 'SUPPORT' ? '#faf8f5' : '#fff',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 6,
                        fontSize: 11,
                        color: '#8a8680',
                      }}
                    >
                      <strong style={{ color: '#3a3a39' }}>
                        {m.sender_type === 'SUPPORT' ? 'Support' : 'Partner'}
                        {m.sender_name ? ` · ${m.sender_name}` : ''}
                      </strong>
                      <span>{formatUtcCompact(m.created_at)}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {m.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="form-note" role="alert">Ticket not found.</p>
        )}
      </Modal>

      <Modal
        open={composerOpen}
        onClose={resetComposer}
        title="New support ticket"
        copy="Filed on behalf of the selected partner. The opening message is sent as Support; the ticket lands in the queue with status Open."
        actions={
          <>
            <button className="secondary-button" type="button" onClick={resetComposer}>
              Cancel
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={submitTicket}
              disabled={submitting}
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 6 }}>
          {submitError ? (
            <p className="form-note" role="alert">{submitError}</p>
          ) : null}
          <Field label="Partner">
            <Select
              value={partner || partnerOptions[0]?.value || ''}
              onChange={setPartner}
              options={
                partnerOptions.length
                  ? partnerOptions
                  : [{ value: '', label: partners.isLoading ? 'Loading partners…' : 'No partners found' }]
              }
            />
          </Field>
          <Field label="Subject">
            <input
              className="input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Invite expired for northstar-video.tv"
            />
          </Field>
          <Field label="Category">
            <Select
              value={newCategory}
              onChange={setNewCategory}
              options={TICKET_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
            />
          </Field>
          <Field label="Priority">
            <Select
              value={newPriority}
              onChange={setNewPriority}
              options={TICKET_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
            />
          </Field>
          <Field label="Message">
            <textarea
              className="textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe the issue, the affected site and the expected outcome."
            />
          </Field>
        </div>
      </Modal>
    </>
  )
}
