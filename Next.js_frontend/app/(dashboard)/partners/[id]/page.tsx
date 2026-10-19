'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import {
  BarList, Chip, DataTable, EmptyView, KeyValue, LoadingRows, PageHeader, Panel, Pill, Status,
  Tabs, type Column,
} from '@/components/kit'
import { useAudit, usePartner, usePartnerUsers, useRevenueRecords, useSites } from '@/lib/hooks'
import type { AuditEvent, PartnerUser, PublisherSite, RevenueRecord } from '@/lib/data/types'

function money(value: number) {
  const sign = value < 0 ? '-' : ''
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function stamp(value: string | null) {
  if (!value) return 'Never'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const stateTone: Record<RevenueRecord['state'], string> = {
  finalized: 'success',
  reconciled: 'success',
  validated: 'info',
  provisional: 'neutral',
  adjusted: 'warning',
}

const userColumns: Column<PartnerUser>[] = [
  { key: 'name', header: 'Name', render: (u) => <strong style={{ color: '#3a3a39' }}>{u.full_name}</strong> },
  { key: 'email', header: 'Email', render: (u) => u.email },
  { key: 'role', header: 'Role', render: (u) => <Chip tone="info">{u.role}</Chip> },
  { key: 'status', header: 'Status', render: (u) => <Status value={u.status} /> },
  { key: 'login', header: 'Last login', render: (u) => stamp(u.last_login) },
  { key: 'created', header: 'Created', render: (u) => u.created_at },
]

const siteColumns: Column<PublisherSite>[] = [
  { key: 'site', header: 'Site', render: (s) => <strong style={{ color: '#3a3a39' }}>{s.site}</strong> },
  { key: 'status', header: 'Status', render: (s) => <Status value={s.status} /> },
  { key: 'api', header: 'API', render: (s) => <div><Status value={s.api_status.replace('_', ' ')} /></div> },
  { key: 'delegation', header: 'Delegation', render: (s) => <Pill value={s.delegation} /> },
  { key: 'ads', header: 'ads.txt', render: (s) => <Status value={s.ads_txt} /> },
  { key: 'onboarding', header: 'Onboarding', render: (s) => s.onboarding_date },
]

const revenueColumns: Column<RevenueRecord>[] = [
  { key: 'date', header: 'Date', render: (r) => r.date },
  { key: 'site', header: 'Site', render: (r) => <strong style={{ color: '#3a3a39' }}>{r.site}</strong> },
  { key: 'impressions', header: 'Impressions', render: (r) => r.impressions.toLocaleString('en-US') },
  { key: 'gross', header: 'Gross', render: (r) => money(r.gross) },
  { key: 'adjustments', header: 'Adjustments', render: (r) => money(r.adjustments) },
  { key: 'net', header: 'Net', render: (r) => money(r.net) },
  {
    key: 'state',
    header: 'State',
    render: (r) => <Chip tone={stateTone[r.state]}>{r.state}</Chip>,
  },
]

const auditColumns: Column<AuditEvent>[] = [
  { key: 'time', header: 'Time', render: (a) => stamp(a.timestamp) },
  { key: 'action', header: 'Action', render: (a) => a.action },
  { key: 'actor', header: 'Actor', render: (a) => a.actor },
  { key: 'description', header: 'Description', render: (a) => a.description },
]

const tabDefs = [
  { label: 'Overview', value: 'overview' },
  { label: 'Users', value: 'users' },
  { label: 'Sites', value: 'sites' },
  { label: 'Revenue', value: 'revenue' },
  { label: 'Audit', value: 'audit' },
]

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: partner, isLoading } = usePartner(id)
  const [tab, setTab] = useState('overview')

  const users = usePartnerUsers(partner?.partner_ticket)
  const sites = useSites({ page_size: 100 })
  const revenue = useRevenueRecords({ page_size: 100 })
  const audit = useAudit({ page_size: 100 })

  if (isLoading) return <LoadingRows rows={6} cols={4} />

  if (!partner) {
    return (
      <EmptyView
        title="Partner not found"
        description="No tenant matches this identifier. Return to the directory and open an existing partner record."
        action="Back to partners"
        onAction={() => router.push('/partners')}
      />
    )
  }

  const ticket = partner.partner_ticket
  const partnerSites = (sites.data?.results ?? []).filter((s) => s.partner_ticket === ticket)
  const partnerUsers = (users.data?.results ?? []).filter((u) => u.partner_ticket === ticket)
  const partnerRevenue = (revenue.data?.results ?? []).filter((r) => r.partner_ticket === ticket)
  const partnerAudit = (audit.data?.results ?? []).filter((a) => a.partner_ticket === ticket)

  const tabs = tabDefs.map((t) =>
    t.value === 'users' ? { ...t, count: partnerUsers.length }
      : t.value === 'sites' ? { ...t, count: partnerSites.length }
      : t.value === 'revenue' ? { ...t, count: partnerRevenue.length }
      : t.value === 'audit' ? { ...t, count: partnerAudit.length }
      : t,
  )

  const profile = (
    <div className="detail-grid">
      <Panel kicker="IDENTITY" title="Partner profile">
        <KeyValue
          items={[
            { label: 'Partner ticket', value: partner.partner_ticket },
            { label: 'Type', value: partner.type },
            { label: 'Contact name', value: partner.contact_name },
            { label: 'Contact email', value: partner.contact_email },
            { label: 'Revenue share', value: `${partner.revenue_share}%` },
            { label: 'MCM connection', value: partner.mcm },
            { label: 'Created', value: partner.created_at },
            { label: 'Updated', value: partner.updated_at },
            { label: 'Last login', value: stamp(partner.last_login) },
            { label: 'Notes', value: partner.notes || '—' },
          ]}
        />
      </Panel>

      <Panel kicker="COMMERCIAL" title="Revenue share">
        <BarList
          items={[
            {
              label: 'Partner share',
              value: partner.revenue_share,
              display: money((partner.revenue * partner.revenue_share) / 100),
            },
            {
              label: 'AdGlobeX share',
              value: 100 - partner.revenue_share,
              display: money((partner.revenue * (100 - partner.revenue_share)) / 100),
            },
          ]}
        />
        <div className="metric-row">
          <div className="metric">
            <span>Sites</span>
            <strong>{partner.sites.toLocaleString('en-US')}</strong>
            <small>properties on record</small>
          </div>
          <div className="metric">
            <span>Active sites</span>
            <strong>{partner.active_sites.toLocaleString('en-US')}</strong>
            <small>serving inventory</small>
          </div>
          <div className="metric">
            <span>Revenue this period</span>
            <strong>${partner.revenue.toLocaleString('en-US')}</strong>
            <small>gross, current statement cycle</small>
          </div>
        </div>
      </Panel>
    </div>
  )

  return (
    <>
      <Link className="back-link" href="/partners">← All partners</Link>

      <PageHeader
        eyebrow={partner.partner_ticket}
        title={partner.name}
        subtitle={`${partner.type} · ${partner.mcm}`}
        actions={
          <>
            <button className="secondary-button" type="button">
              {partner.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
            </button>
            <button className="primary-button" type="button">
              <UserPlus /> Add user
            </button>
          </>
        }
      />

      <div className="filter-row">
        <Status value={partner.status} />
        <span className="live-status">
          <span className="live-dot" />
          {partner.active_sites} of {partner.sites} sites active · last login {stamp(partner.last_login)}
        </span>
      </div>

      {profile}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'overview' ? (
        <section className="panel partners-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">INVENTORY</p>
              <h2>Recent activity</h2>
            </div>
            <div className="table-actions">
              <span className="field-hint">{partnerSites.length} sites under this tenant</span>
            </div>
          </div>

          {sites.isLoading ? (
            <LoadingRows rows={4} cols={3} />
          ) : partnerSites.length === 0 ? (
            <div className="table-empty">No publisher sites are linked to this partner yet.</div>
          ) : (
            <div className="timeline">
              {partnerSites.map((s) => (
                <div className="timeline-item" key={s.id}>
                  <strong>{s.site}</strong>
                  <span>
                    {s.status} · API {s.api_status.replace('_', ' ')} · delegated {s.delegation} ·
                    onboarded {s.onboarding_date}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="panel partners-panel">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">{tab.toUpperCase()}</p>
              <h2>
                {tab === 'users' ? 'Partner users'
                  : tab === 'sites' ? 'Publisher sites'
                  : tab === 'revenue' ? 'Revenue records'
                  : 'Audit trail'}
              </h2>
            </div>
          </div>

          {tab === 'users' ? (
            users.isLoading ? (
              <LoadingRows rows={4} cols={6} />
            ) : partnerUsers.length === 0 ? (
              <EmptyView
                title="No users yet"
                description="No team members are provisioned for this tenant. Add a user to grant scoped access under the partner's role model."
              />
            ) : (
              <DataTable columns={userColumns} rows={partnerUsers} rowKey={(u) => u.id} />
            )
          ) : null}

          {tab === 'sites' ? (
            sites.isLoading ? (
              <LoadingRows rows={5} cols={6} />
            ) : partnerSites.length === 0 ? (
              <EmptyView
                title="No sites on this tenant"
                description="This partner has no publisher relationships in the lifecycle table. Onboard a publisher to start tracking invites and MCM health."
              />
            ) : (
              <DataTable columns={siteColumns} rows={partnerSites} rowKey={(s) => s.id} />
            )
          ) : null}

          {tab === 'revenue' ? (
            revenue.isLoading ? (
              <LoadingRows rows={5} cols={7} />
            ) : partnerRevenue.length === 0 ? (
              <EmptyView
                title="No revenue records"
                description="No settled or provisional revenue has been recorded for this partner in the current data set."
              />
            ) : (
              <DataTable columns={revenueColumns} rows={partnerRevenue} rowKey={(r) => r.id} />
            )
          ) : null}

          {tab === 'audit' ? (
            audit.isLoading ? (
              <LoadingRows rows={5} cols={4} />
            ) : partnerAudit.length === 0 ? (
              <EmptyView
                title="No audit events"
                description="No administrative actions have been recorded against this tenant yet."
              />
            ) : (
              <DataTable columns={auditColumns} rows={partnerAudit} rowKey={(a) => a.id} />
            )
          ) : null}
        </section>
      )}
    </>
  )
}
