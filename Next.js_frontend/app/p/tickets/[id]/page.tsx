'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Lock, Send } from 'lucide-react'
import {
  ErrorPanel, KeyValue, LoadingRows, PageHeader, Panel, Pill, Status,
} from '@/components/kit'
import { usePartnerTicket, useReplyTicket } from '@/lib/partner-api'
import {
  CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS, type TicketCategory, type TicketPriority,
  type TicketStatus,
} from '@/lib/tickets'
import { formatUtcShort } from '@/lib/date'

const ACTION_LABELS: Record<string, string> = {
  CREATED: 'Ticket filed',
  REPLIED: 'Replied',
  STATUS_CHANGED: 'Status changed',
  PRIORITY_CHANGED: 'Priority changed',
  ASSIGNED: 'Assigned',
}

export default function PartnerTicketDetailPage() {
  const params = useParams<{ id: string }>()
  const ticketId = params?.id ?? ''

  const detail = usePartnerTicket(ticketId)
  const reply = useReplyTicket(ticketId)
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState<string | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.trim()) return
    setNotice(null)
    try {
      const result = await reply.mutateAsync(draft.trim())
      setDraft('')
      setNotice(
        result.reopened
          ? 'Reply sent. This ticket was resolved, so it has been reopened.'
          : 'Reply sent.',
      )
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not send the reply')
    }
  }

  if (detail.isError) {
    return (
      <>
        <PageHeader eyebrow="SUPPORT" title="Ticket" subtitle="Loading the conversation." />
        <ErrorPanel
          message={(detail.error as Error).message}
          onRetry={() => detail.refetch()}
        />
        <div style={{ marginTop: 16 }}>
          <Link className="secondary-button" href="/p/tickets">
            <ArrowLeft /> Back to tickets
          </Link>
        </div>
      </>
    )
  }

  const t = detail.data?.ticket
  const closed = t?.status === 'CLOSED'

  return (
    <>
      <PageHeader
        eyebrow={t ? `TICKET ${t.ticketId}` : 'SUPPORT'}
        title={t?.subject ?? 'Ticket'}
        subtitle={
          t
            ? `Filed ${formatUtcShort(t.createdAt)} UTC · ${t.messageCount} ${
                t.messageCount === 1 ? 'message' : 'messages'
              }`
            : 'Loading the conversation.'
        }
        actions={
          <Link className="secondary-button" href="/p/tickets">
            <ArrowLeft /> Back to tickets
          </Link>
        }
      />

      {t ? (
        <div className="filter-row" style={{ gap: 10 }}>
          <Status value={STATUS_LABELS[t.status as TicketStatus] ?? t.status} />
          <Pill value={CATEGORY_LABELS[t.category as TicketCategory] ?? t.category} />
          <Pill value={`Priority: ${PRIORITY_LABELS[t.priority as TicketPriority] ?? t.priority}`} />
          {t.assignedTo ? <Pill value={`Assigned to ${t.assignedTo}`} /> : null}
        </div>
      ) : null}

      <div className="detail-grid">
        <Panel kicker="CONVERSATION" title={t ? `${t.messageCount} messages` : 'Conversation'}>
          {detail.isLoading ? (
            <LoadingRows rows={5} cols={3} />
          ) : (
            <>
              <div className="msg-list">
                {(detail.data?.messages ?? []).map((m) => (
                  <article
                    key={m.messageId}
                    className={m.senderType === 'PARTNER' ? 'msg msg-partner' : 'msg msg-support'}
                  >
                    <header className="msg-meta">
                      <strong>{m.senderType === 'PARTNER' ? 'You' : 'AdGlobeX Support'}</strong>
                      <span>{formatUtcShort(m.createdAt)} UTC</span>
                    </header>
                    <div className="msg-body">{m.body}</div>
                  </article>
                ))}
                {(detail.data?.messages ?? []).length === 0 ? (
                  <div className="table-empty">No messages on this ticket yet.</div>
                ) : null}
              </div>

              {closed ? (
                <p className="form-note" style={{ marginTop: 18, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Lock style={{ width: 14, flex: '0 0 auto' }} />
                  This ticket is closed and can no longer be replied to. File a new ticket to start a
                  fresh thread.
                </p>
              ) : (
                <form className="ticket-reply" onSubmit={send}>
                  {notice ? (
                    <p className={notice.startsWith('Reply sent') ? 'form-note' : 'auth-error'} role="status">
                      {notice}
                    </p>
                  ) : null}
                  <FieldLike label="Reply">
                    <textarea
                      className="input textarea"
                      rows={4}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      maxLength={8000}
                      placeholder="Add to this conversation…"
                    />
                  </FieldLike>
                  <div className="form-actions">
                    <button
                      className="primary-button"
                      type="submit"
                      disabled={reply.isPending || !draft.trim()}
                      style={
                        reply.isPending || !draft.trim()
                          ? { opacity: 0.55, cursor: 'not-allowed' }
                          : undefined
                      }
                    >
                      <Send /> {reply.isPending ? 'Sending…' : 'Send reply'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </Panel>

        <div>
          <Panel kicker="DETAILS" title="Ticket details" className="ticket-details">
            {detail.isLoading || !t ? (
              <LoadingRows rows={6} cols={2} />
            ) : (
              <KeyValue
                items={[
                  { label: 'Ticket ID', value: <span className="pill">{t.ticketId}</span> },
                  { label: 'Status', value: STATUS_LABELS[t.status as TicketStatus] ?? t.status },
                  {
                    label: 'Category',
                    value: CATEGORY_LABELS[t.category as TicketCategory] ?? t.category,
                  },
                  { label: 'Priority', value: PRIORITY_LABELS[t.priority as TicketPriority] ?? t.priority },
                  { label: 'Assigned to', value: t.assignedTo ?? 'Unassigned' },
                  { label: 'Filed by', value: t.createdBy.name || t.createdBy.email || '—' },
                  { label: 'Created', value: formatUtcShort(t.createdAt) },
                  { label: 'Last update', value: formatUtcShort(t.lastMessageAt ?? t.updatedAt) },
                  { label: 'Resolved', value: t.resolvedAt ? formatUtcShort(t.resolvedAt) : '—' },
                ]}
              />
            )}
          </Panel>

          <Panel kicker="HISTORY" title="Activity" className="settings-block">
            {detail.isLoading ? (
              <LoadingRows rows={4} cols={2} />
            ) : (
              <ul className="activity-list" style={{ marginTop: 8 }}>
                {(detail.data?.history ?? []).map((h) => (
                  <li className="activity-item" key={h.historyId}>
                    <div className="activity-icon">
                      <span style={{ fontSize: 9, fontWeight: 800 }}>
                        {h.action === 'CREATED' ? 'NEW' : h.action === 'REPLIED' ? 'MSG' : 'CHG'}
                      </span>
                    </div>
                    <div className="activity-copy">
                      <p>
                        {ACTION_LABELS[h.action] ?? h.action}
                        {h.field && h.toValue ? ` · ${h.fromValue ?? '—'} → ${h.toValue}` : ''}
                      </p>
                      <span>
                        {h.actorName ?? (h.actorType === 'SUPPORT' ? 'Support' : 'You')} ·{' '}
                        {formatUtcShort(h.createdAt)} UTC
                      </span>
                    </div>
                  </li>
                ))}
                {(detail.data?.history ?? []).length === 0 ? (
                  <li className="table-empty">No activity recorded yet.</li>
                ) : null}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}

/** Thin local wrapper so the reply box matches the kit's Field markup. */
function FieldLike({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="form-field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}
