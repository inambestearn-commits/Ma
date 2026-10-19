'use client'

import { useState } from 'react'
import { Banknote, CircleDollarSign, Clock, CreditCard, Hourglass, RefreshCw } from 'lucide-react'
import {
  DataTable, EmptyView, FilterRow, KeyValue, LoadingRows, Modal, PageHeader, Panel, SearchField,
  StatCard, Status, type Column,
} from '@/components/kit'
import { useCsvImports, usePayments, useStatements } from '@/lib/hooks'
import { usePortal } from '@/lib/portal'
import type { CsvImport, Payment, Statement } from '@/lib/data/types'

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const signed = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const stamp = (iso: string) => iso.replace('T', ' ').replace('Z', ' UTC').slice(0, 16)

const period = (p: { period_start: string; period_end: string }) => `${p.period_start} → ${p.period_end}`

const partnerCell = (name: string, ticket: string) => (
  <div className="partner-cell">
    <div>
      <strong>{name}</strong>
      <span>{ticket}</span>
    </div>
  </div>
)

const queueColumns = (onRelease: (p: Payment) => void): Column<Payment>[] => [
  { key: 'reference', header: 'Reference', render: (p) => <strong>{p.reference}</strong> },
  { key: 'partner', header: 'Partner', render: (p) => partnerCell(p.partner_name, p.partner_ticket) },
  { key: 'period', header: 'Period', render: (p) => period(p) },
  { key: 'amount', header: 'Amount', render: (p) => money(p.amount) },
  {
    key: 'adjustments',
    header: 'Adjustments',
    render: (p) => (
      <span style={{ color: p.adjustments < 0 ? '#c97258' : undefined }}>{signed(p.adjustments)}</span>
    ),
  },
  { key: 'status', header: 'Status', render: (p) => <Status value={p.status} /> },
  { key: 'statement', header: 'Statement', render: (p) => <span className="pill">{p.statement_ref}</span> },
  { key: 'released', header: 'Released', render: (p) => p.released_date ?? '—' },
  {
    key: 'action',
    header: 'Action',
    render: (p) => (
      <button
        type="button"
        className="secondary-button"
        disabled={p.status === 'Released'}
        style={p.status === 'Released' ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
        onClick={() => onRelease(p)}
      >
        Release
      </button>
    ),
  },
]

const statementColumns: Column<Statement>[] = [
  { key: 'id', header: 'Statement', render: (s) => <strong>{s.id}</strong> },
  { key: 'partner', header: 'Partner', render: (s) => partnerCell(s.partner_name, s.partner_ticket) },
  { key: 'period', header: 'Period', render: (s) => s.period },
  { key: 'gross', header: 'Gross', render: (s) => money(s.gross) },
  {
    key: 'adjustments',
    header: 'Adjustments',
    render: (s) => (
      <span style={{ color: s.adjustments < 0 ? '#c97258' : undefined }}>{signed(s.adjustments)}</span>
    ),
  },
  { key: 'net', header: 'Net payable', render: (s) => money(s.net_payable) },
  { key: 'status', header: 'Status', render: (s) => <Status value={s.status} /> },
  { key: 'due', header: 'Due', render: (s) => s.due_date },
]

const csvColumns: Column<CsvImport>[] = [
  { key: 'month', header: 'Month / Year', render: (c) => <strong>{`${c.month} ${c.year}`}</strong> },
  { key: 'uploaded', header: 'Uploaded', render: (c) => stamp(c.uploaded_at) },
  { key: 'uploader', header: 'Uploader', render: (c) => c.uploader },
  { key: 'hash', header: 'Hash', render: (c) => <span className="pill">{c.file_hash}</span> },
  { key: 'rows', header: 'Rows', render: (c) => c.rows.toLocaleString('en-US') },
  {
    key: 'errors',
    header: 'Errors',
    render: (c) => (
      <span style={{ color: c.errors > 0 ? '#c97258' : undefined }}>{c.errors.toLocaleString('en-US')}</span>
    ),
  },
  { key: 'status', header: 'Status', render: (c) => <Status value={c.status} /> },
]

const paymentHistoryColumns: Column<Payment>[] = [
  { key: 'reference', header: 'Reference', render: (p) => <strong>{p.reference}</strong> },
  { key: 'period', header: 'Period', render: (p) => period(p) },
  { key: 'amount', header: 'Amount', render: (p) => money(p.amount) },
  { key: 'released', header: 'Released', render: (p) => p.released_date ?? '—' },
  { key: 'status', header: 'Status', render: (p) => <Status value={p.status} /> },
]

function AdminPayments() {
  const [search, setSearch] = useState('')
  const [confirm, setConfirm] = useState<Payment | null>(null)

  const payments = usePayments({ search })
  const statements = useStatements()
  const csvImports = useCsvImports()

  const rows = payments.data?.results ?? []
  const sumByStatus = (status: Payment['status']) =>
    rows.filter((p) => p.status === status).reduce((total, p) => total + p.amount, 0)
  const countByStatus = (status: Payment['status']) => rows.filter((p) => p.status === status).length

  const releasedThisMonth = rows
    .filter((p) => p.status === 'Released' && (p.released_date ?? '').startsWith('2026-10'))
    .reduce((total, p) => total + p.amount, 0)
  const releasedCount = rows.filter(
    (p) => p.status === 'Released' && (p.released_date ?? '').startsWith('2026-10'),
  ).length

  const stats = [
    {
      title: 'Released this month',
      value: money(releasedThisMonth),
      icon: Banknote,
      helper: `${releasedCount} payment · October 2026`,
    },
    {
      title: 'Pending approval',
      value: money(sumByStatus('Pending')),
      icon: Hourglass,
      helper: `${countByStatus('Pending')} payments awaiting finance`,
    },
    {
      title: 'On hold',
      value: money(sumByStatus('On hold')),
      icon: Clock,
      helper: `${countByStatus('On hold')} payment blocked by statement review`,
    },
    {
      title: 'Processing',
      value: money(sumByStatus('Processing')),
      icon: RefreshCw,
      helper: `${countByStatus('Processing')} payment in transfer`,
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="FINANCE"
        title="Payments"
        subtitle="Partner payment records, release dates, statements and monthly CSV history."
        actions={
          <>
            <button className="secondary-button" type="button">
              <CreditCard /> Import monthly CSV
            </button>
            <button className="primary-button" type="button">
              <CircleDollarSign /> Release selected payment
            </button>
          </>
        }
      />

      <section className="stats-grid" aria-label="Payment summary">
        {payments.isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div className="stat-card" key={i}>
                <LoadingRows rows={1} cols={1} />
              </div>
            ))
          : stats.map((s) => <StatCard key={s.title} {...s} />)}
      </section>

      <FilterRow>
        <SearchField value={search} onChange={setSearch} placeholder="Search partner, ticket or reference" />
      </FilterRow>

      <Panel kicker="PAYMENT QUEUE" title="Payments awaiting release">
        {payments.isLoading ? (
          <LoadingRows rows={5} cols={8} />
        ) : (
          <DataTable
            columns={queueColumns(setConfirm)}
            rows={rows}
            rowKey={(p) => p.id}
            empty="No payments match this search. Clear the search field to see the full queue."
          />
        )}
      </Panel>

      <Panel kicker="STATEMENTS" title="Period statements">
        {statements.isLoading ? (
          <LoadingRows rows={4} cols={8} />
        ) : (
          <DataTable
            columns={statementColumns}
            rows={statements.data?.results ?? []}
            rowKey={(s) => s.id}
            empty="No statements have been generated for the current period."
          />
        )}
      </Panel>

      <Panel kicker="MONTHLY CSV HISTORY" title="Reporting imports">
        {csvImports.isLoading ? (
          <LoadingRows rows={4} cols={8} />
        ) : (
          <>
            <DataTable
              columns={csvColumns}
              rows={csvImports.data?.results ?? []}
              rowKey={(c) => c.id}
              empty="No monthly CSV has been uploaded yet."
            />
            <p className="form-note">
              Idempotent import flow (§17.3): upload → validate → preview → confirm → import →
              reconcile → audit. A file re-uploaded with the same hash is skipped, every confirmation
              is written to the audit log, and imported rows are reconciled against existing partner
              and site records before the period is closed.
            </p>
          </>
        )}
      </Panel>

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Release this payment?"
        copy={
          confirm
            ? `${money(confirm.amount)} will be released to ${confirm.partner_name} for ${period(confirm)} against statement ${confirm.statement_ref}. The release date, reference and audit entry are written server-side and cannot be undone.`
            : ''
        }
        actions={
          <>
            <button className="secondary-button" type="button" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button className="primary-button" type="button" onClick={() => setConfirm(null)}>
              Release payment
            </button>
          </>
        }
      />
    </>
  )
}

function PartnerPayments() {
  const payments = usePayments()
  const statements = useStatements({ search: 'AGX-1001' })

  const rows = payments.data?.results ?? []
  const mine = rows.filter((p) => p.partner_ticket === 'AGX-1001')
  const outstanding = mine.filter((p) => p.status !== 'Released')
  const releasedRows = mine.filter((p) => p.status === 'Released')
  const balance = outstanding.reduce((total, p) => total + p.amount, 0)
  const released = releasedRows.reduce((total, p) => total + p.amount, 0)
  const lastRelease = releasedRows
    .map((p) => p.released_date ?? '')
    .sort()
    .slice(-1)[0]
  const next = outstanding[0]

  const statementRows = [...(statements.data?.results ?? [])].sort((a, b) =>
    b.period_start.localeCompare(a.period_start),
  )
  const statement = statementRows[0]

  return (
    <>
      <PageHeader
        eyebrow="PARTNER FINANCE"
        title="Payments"
        subtitle="Balance, MCM monthly report and payment history for AGX-1001."
      />

      <div className="metric-row">
        {payments.isLoading ? (
          <LoadingRows rows={1} cols={3} />
        ) : (
          <>
            <div className="metric">
              <span>Current balance</span>
              <strong>{money(balance)}</strong>
              <small>{outstanding.length} payment awaiting release</small>
            </div>
            <div className="metric">
              <span>Released to date</span>
              <strong>{money(released)}</strong>
              <small>{lastRelease ? `last release ${lastRelease}` : 'no releases yet'}</small>
            </div>
            <div className="metric">
              <span>Next release</span>
              <strong>{next?.reference ?? '—'}</strong>
              <small>{next ? `${period(next)} · pending finance approval` : 'nothing scheduled'}</small>
            </div>
          </>
        )}
      </div>

      <Panel kicker="MCM MONTHLY REPORT" title="Current reporting cycle">
        {statements.isLoading ? (
          <LoadingRows rows={4} cols={2} />
        ) : statement ? (
          <>
            <KeyValue
              items={[
                { label: 'Reporting cycle', value: 'Monthly · configured' },
                { label: 'Period', value: statement.period },
                { label: 'Gross', value: money(statement.gross) },
                {
                  label: 'Adjustments',
                  value: (
                    <span style={{ color: statement.adjustments < 0 ? '#c97258' : undefined }}>
                      {signed(statement.adjustments)}
                    </span>
                  ),
                },
                { label: 'Net payable', value: money(statement.net_payable) },
                { label: 'Status', value: <Status value={statement.status} /> },
              ]}
            />
            <p className="form-note">
              The reporting cycle is configured per partner agreement and resolved server-side — it is
              never hard-coded to a calendar date (§6.5). The period shown above is the cycle that has
              been closed, approved and scheduled for release.
            </p>
          </>
        ) : (
          <div className="table-empty">No statement has been issued for AGX-1001 yet.</div>
        )}
      </Panel>

      <Panel kicker="PAYMENT HISTORY" title="Released and scheduled payments">
        {payments.isLoading ? (
          <LoadingRows rows={4} cols={5} />
        ) : mine.length === 0 ? (
          <EmptyView
            title="No payments recorded"
            description="Payments appear here once a period statement is approved. Your current balance and release schedule are shown above."
            icon={CreditCard}
          />
        ) : (
          <DataTable
            columns={paymentHistoryColumns}
            rows={mine}
            rowKey={(p) => p.id}
            empty="No payments recorded for AGX-1001."
          />
        )}
      </Panel>
    </>
  )
}

export default function PaymentsPage() {
  const { portal } = usePortal()
  return portal === 'admin' ? <AdminPayments /> : <PartnerPayments />
}
