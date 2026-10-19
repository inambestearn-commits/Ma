'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import {
  DataTable, ErrorPanel, LoadingRows, PageHeader, Status, type Column,
} from '@/components/kit'
import { usePartnerSubmissions, type PartnerSubmission } from '@/lib/partner-api'
import { formatUtcCompact } from '@/lib/date'

/** 5000 millipercent (parent keeps 5%) -> "5 / 95" (parent / child). */
function shareLabel(millipercent: number): string {
  if (!millipercent) return '—'
  const parent = millipercent / 1000
  return `${parent} / ${100 - parent}`
}

const STATUS_LABELS: Record<string, string> = {
  unread: 'Unread',
  submitted: 'Submitted',
  failed: 'Failed',
}

const columns: Column<PartnerSubmission>[] = [
  {
    key: 'request',
    header: 'Request',
    render: (r) => (
      <div>
        <strong style={{ display: 'block', color: '#3a3a39' }}>{r.site}</strong>
        <small style={{ color: '#aaa6a0', fontSize: 10 }}>{r.requestId}</small>
      </div>
    ),
  },
  {
    key: 'email',
    header: 'Publisher email',
    render: (r) => <span style={{ color: '#66635f' }}>{r.gamEmail}</span>,
  },
  { key: 'share', header: 'Revenue share', render: (r) => shareLabel(r.revenueShareMillipercent) },
  {
    key: 'status',
    header: 'Status',
    render: (r) => <Status value={STATUS_LABELS[r.status] ?? r.status} />,
  },
  { key: 'created', header: 'Submitted', render: (r) => formatUtcCompact(r.createdAt) },
]

export default function PublisherRequestsPage() {
  const { data, isLoading, error } = usePartnerSubmissions()
  const requests = data?.requests ?? []

  return (
    <>
      <Link className="back-link" href="/p/publishers">← Manage publishers</Link>

      <PageHeader
        eyebrow="ONBOARDING"
        title="My requests"
        subtitle="Every publisher you have submitted, including the ones blocked as duplicates. A blocked request stays here until the operations team has reviewed it."
        actions={
          <Link className="primary-button" href="/p/publishers/new">
            <Plus /> Add publisher
          </Link>
        }
      />

      {isLoading ? <LoadingRows rows={5} /> : null}
      {error ? <ErrorPanel message={(error as Error).message} /> : null}

      {!isLoading && !error ? (
        <DataTable
          columns={columns}
          rows={requests}
          rowKey={(r) => r.requestId}
          empty="No requests yet."
        />
      ) : null}
    </>
  )
}
