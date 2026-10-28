'use client'

import Link from 'next/link'
import { Plus, Users2 } from 'lucide-react'
import { DataTable, ErrorPanel, LoadingRows, PageHeader, Status, type Column } from '@/components/kit'
import { useSubPartners, type SubPartner } from '@/lib/partner-api'
import { formatUtcCompact } from '@/lib/date'

const columns: Column<SubPartner>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (r) => (
      <div>
        <strong style={{ display: 'block', color: '#3a3a39' }}>{r.name}</strong>
        <small style={{ color: '#aaa6a0', fontSize: 10 }}>{r.subTicket}</small>
      </div>
    ),
  },
  {
    key: 'email',
    header: 'Login email',
    render: (r) => <span style={{ color: '#66635f' }}>{r.email}</span>,
  },
  {
    key: 'share',
    header: 'Revenue ratio',
    render: (r) => <span>{r.revenueShare}%</span>,
  },
  {
    key: 'tag',
    header: 'Partner tag',
    render: (r) => (
      <code style={{ fontSize: 11, background: '#f2efe9', padding: '2px 6px', borderRadius: 4 }}>
        {r.subTag}
      </code>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (r) => <Status value={r.status} />,
  },
  {
    key: 'created',
    header: 'Created',
    render: (r) => formatUtcCompact(r.createdAt),
  },
]

export default function SubPartnersPage() {
  const { data, isLoading, error } = useSubPartners()
  const subPartners = data?.subPartners ?? []

  return (
    <>
      <PageHeader
        eyebrow="NETWORK"
        title="Sub partners"
        subtitle="Sub partners share your network under their own dedicated tag. They see only their own sites and revenue — you see everything."
        actions={
          <Link className="primary-button" href="/p/sub-partners/new">
            <Plus /> Create sub partner
          </Link>
        }
      />

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">SUB PARTNERS</p>
            <h2>Your network members</h2>
          </div>
        </div>

        {isLoading ? (
          <LoadingRows rows={4} cols={5} />
        ) : error ? (
          <ErrorPanel message={(error as Error).message} />
        ) : subPartners.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              padding: '48px 24px',
              color: '#a5a19b',
              textAlign: 'center',
            }}
          >
            <Users2 size={36} strokeWidth={1.4} />
            <p style={{ margin: 0, fontSize: 14 }}>No sub partners yet.</p>
            <Link className="primary-button" href="/p/sub-partners/new">
              <Plus /> Create your first sub partner
            </Link>
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={subPartners}
            rowKey={(r) => r.subPartnerId}
          />
        )}
      </section>
    </>
  )
}
