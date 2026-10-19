'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CircleAlert, Network, Plug, RefreshCw, Server, Users } from 'lucide-react'
import * as api from '@/lib/api'
import {
  Chip, DataTable, EmptyView, KeyValue, LoadingRows, Modal, PageHeader, Panel, Pill, SearchField,
  StatCard, Status, type Column,
} from '@/components/kit'
import { useMcmConnections, useMcmLog, useMcmRelationships } from '@/lib/hooks'
import type { McmConnection, McmRelationship } from '@/lib/data/types'

const stamp = (iso: string) => iso.replace('T', ' ').replace('Z', ' UTC')

const healthTone = (health: McmConnection['health']) =>
  health === 'Healthy' ? 'success' : health === 'Degraded' ? 'warning' : 'critical'

const relationshipColumns: Column<McmRelationship>[] = [
  { key: 'site', header: 'Site', render: (r) => <strong style={{ color: '#3a3a39' }}>{r.site}</strong> },
  {
    key: 'partner',
    header: 'Partner',
    render: (r) => (
      <div className="partner-cell">
        <div>
          <strong>{r.partner_ticket}</strong>
          <span>publisher relationship</span>
        </div>
      </div>
    ),
  },
  { key: 'mcm', header: 'MCM', render: (r) => <span className="pill">{r.mcm_id}</span> },
  { key: 'network', header: 'Network code', render: (r) => r.network_code },
  { key: 'invite', header: 'Invite state', render: (r) => <Status value={r.invite_state} /> },
  { key: 'api', header: 'API', render: (r) => <Status value={r.api_status.replace('_', ' ')} /> },
  { key: 'sync', header: 'Last sync', render: (r) => stamp(r.last_sync) },
]

export default function McmPage() {
  const connections = useMcmConnections()
  const [search, setSearch] = useState('')
  const relationships = useMcmRelationships({ search })
  const log = useMcmLog()
  const contract = useQuery({ queryKey: ['mcm-contract'], queryFn: api.mcmAdapterContract })

  const [healthOpen, setHealthOpen] = useState(false)
  const [selected, setSelected] = useState<McmRelationship | null>(null)

  const conns = connections.data ?? []
  const relRows = relationships.data?.results ?? []
  const inviteErrors = relRows.filter((r) => r.api_status === 'API_ERROR').length

  const stats = [
    {
      title: 'Active connections',
      value: String(conns.filter((c) => c.status === 'Active').length),
      icon: Server,
      helper: `${conns.length} connections configured`,
    },
    {
      title: 'Relationships',
      value: relationships.data ? String(relationships.data.count) : '—',
      icon: Network,
      helper: 'site relationships across MCMs',
    },
    {
      title: 'Last sync',
      value: '3 min ago',
      icon: RefreshCw,
      helper: 'MCM-001 status_sync · healthy',
    },
    {
      title: 'Invite errors',
      value: String(inviteErrors),
      icon: CircleAlert,
      helper: 'relationships with API_ERROR',
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="INTEGRATION"
        title="MCM"
        subtitle="Provider connections, invite lifecycle and API health. Connections are configuration records — a second MCM is added by adapter, never by redesign (BR-012, §32)."
        actions={
          <>
            <button className="secondary-button" type="button" onClick={() => setHealthOpen(true)}>
              <RefreshCw /> Run health check
            </button>
            <button className="primary-button" type="button">
              <Plug /> Add connection
            </button>
          </>
        }
      />

      <section className="stats-grid" aria-label="MCM summary">
        {connections.isLoading || relationships.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div className="stat-card" key={i}>
              <LoadingRows rows={1} cols={1} />
            </div>
          ))
        ) : (
          stats.map((s) => <StatCard key={s.title} {...s} />)
        )}
      </section>

      {connections.isLoading ? (
        <Panel kicker="CONNECTIONS" title="Configured providers">
          <LoadingRows rows={3} cols={6} />
        </Panel>
      ) : (
        conns.map((conn) => (
          <Panel key={conn.mcm_id} kicker={`CONNECTION · ${conn.mcm_id}`} title={conn.mcm_name}>
            <div className="table-actions" style={{ marginTop: '14px' }}>
              <Status value={conn.status} />
              <Chip tone={healthTone(conn.health)}>{conn.health}</Chip>
              {conn.default_flag ? <Chip tone="info">Default connection</Chip> : null}
            </div>

            <KeyValue
              items={[
                { label: 'MCM id', value: conn.mcm_id },
                { label: 'Provider type', value: conn.provider_type },
                { label: 'Account reference', value: conn.account_reference },
                { label: 'Default flag', value: conn.default_flag ? 'Yes' : 'No' },
                { label: 'Priority', value: String(conn.priority) },
                { label: 'Last successful sync', value: stamp(conn.last_success_sync) },
                { label: 'Last attempted sync', value: stamp(conn.last_attempted_sync) },
                { label: 'Last error', value: conn.last_error ?? '—' },
              ]}
            />

            <div className="table-actions" style={{ marginTop: '16px', flexWrap: 'wrap', gap: '8px' }}>
              {conn.capabilities.map((capability) => (
                <Chip key={capability} tone="info">
                  {capability}
                </Chip>
              ))}
            </div>

            {!conn.default_flag ? (
              <p className="form-note">
                Multi-MCM ready (BR-012): this record is configuration only — no relationship, invite or
                reporting behaviour changes until its adapter is enabled. A second MCM is added by
                writing one adapter, never by redesigning Partner or Site modules (§32, §13.3).
              </p>
            ) : null}
          </Panel>
        ))
      )}

      <Panel kicker="ADAPTER CONTRACT" title="Provider adapter surface">
        {contract.isLoading ? (
          <LoadingRows rows={2} cols={6} />
        ) : (
          <div className="table-actions" style={{ marginTop: '16px', flexWrap: 'wrap', gap: '8px' }}>
            {(contract.data ?? []).map((method) => (
              <code key={method}>
                <Pill value={method} />
              </code>
            ))}
          </div>
        )}
        <p className="form-note">
          Adding MCM #2 means writing one more adapter — Partner/Site modules do not change (§13.3).
          Every provider implements this same contract, and external status values are normalised
          through map_external_status() before they reach a relationship row.
        </p>
      </Panel>

      <Panel
        kicker="RELATIONSHIPS"
        title="Invite lifecycle"
        actions={
          <SearchField value={search} onChange={setSearch} placeholder="Search sites, tickets, network codes" />
        }
      >
        {relationships.isLoading ? (
          <LoadingRows rows={6} cols={7} />
        ) : relRows.length === 0 ? (
          <EmptyView
            title="No relationships match this search"
            description={`No invite record matches "${search}". Clear the search to see every relationship managed through the configured MCM connections.`}
            action="Clear search"
            onAction={() => setSearch('')}
            icon={Users}
          />
        ) : (
          <DataTable
            columns={relationshipColumns}
            rows={relRows}
            rowKey={(r) => r.id}
            onRowClick={setSelected}
            empty="No relationship records are available for the current scope."
          />
        )}
      </Panel>

      <Panel kicker="INVITE & SYNC LOG" title="Recent adapter operations">
        {log.isLoading ? (
          <LoadingRows rows={4} cols={1} />
        ) : (
          <div className="timeline">
            {(log.data ?? []).map((entry, index) => (
              <div className="timeline-item" key={`${entry.at}-${entry.op}-${index}`}>
                <strong>
                  {entry.op} · {entry.site}
                </strong>
                <span>
                  {stamp(entry.at)} · {entry.result} · {entry.duration}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Modal
        open={healthOpen}
        onClose={() => setHealthOpen(false)}
        title="Run connection health check?"
        copy="Every configured adapter will answer health_check() and the result is written to System Health. Scheduled status syncs and pending invites are not affected."
        actions={
          <>
            <button className="secondary-button" type="button" onClick={() => setHealthOpen(false)}>
              Cancel
            </button>
            <button className="primary-button" type="button" onClick={() => setHealthOpen(false)}>
              Run health check
            </button>
          </>
        }
      />

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.site} invite history` : 'Invite history'}
        copy={
          selected
            ? `${selected.partner_ticket} · ${selected.mcm_id} · network code ${selected.network_code} · last sync ${stamp(selected.last_sync)}`
            : undefined
        }
        actions={
          <button className="secondary-button" type="button" onClick={() => setSelected(null)}>
            Close
          </button>
        }
      >
        <div className="timeline">
          {(selected?.status_history ?? []).map((entry, index) => (
            <div className="timeline-item" key={`${entry.at}-${index}`}>
              <strong>
                {entry.from} → {entry.to}
              </strong>
              <span>{stamp(entry.at)}</span>
            </div>
          ))}
        </div>
      </Modal>
    </>
  )
}
