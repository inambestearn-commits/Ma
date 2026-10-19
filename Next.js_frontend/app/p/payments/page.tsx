'use client'

import { Banknote, CircleDollarSign, CreditCard, Hourglass, RefreshCw } from 'lucide-react'
import {
  DataTable, EmptyView, ErrorPanel, KeyValue, LoadingRows, PageHeader, Panel, StatCard, Status,
  type Column,
} from '@/components/kit'
import { usePartnerPayments, type PartnerEarningsRow, type PartnerTopSite } from '@/lib/partner-api'

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const signed = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const earningsColumns: Column<PartnerEarningsRow>[] = [
  { key: 'month', header: 'Month', render: (r) => <strong>{r.month}</strong> },
  { key: 'child', header: 'Child network', render: (r) => (
    <div>
      <strong style={{ display: 'block', color: '#3a3a39' }}>{r.childName ?? r.childNetworkCode}</strong>
      <small style={{ color: '#aaa6a0', fontSize: 10 }}>{r.childNetworkCode}</small>
    </div>
  ) },
  { key: 'delegation', header: 'Delegation', render: (r) => r.delegationType ?? '—' },
  { key: 'gross', header: 'Gross earnings', render: (r) => money(r.totalEarnings) },
  {
    key: 'deductions',
    header: 'Deductions',
    render: (r) => (
      <span style={{ color: r.deductions < 0 ? '#c97258' : undefined }}>{signed(-r.deductions)}</span>
    ),
  },
  { key: 'parent', header: 'Parent payment', render: (r) => money(r.parentPayment) },
  { key: 'child', header: 'Child payment', render: (r) => money(r.childPayment) },
]

const topSiteColumns: Column<PartnerTopSite>[] = [
  {
    key: 'domain',
    header: 'Site',
    render: (r) => (
      <div>
        <strong style={{ display: 'block', color: '#3a3a39' }}>{r.domain}</strong>
        <small style={{ color: '#aaa6a0', fontSize: 10 }}>{r.networkCode}</small>
      </div>
    ),
  },
  { key: 'status', header: 'Account', render: (r) => (r.accountStatus ? <Status value={r.accountStatus} /> : '—') },
  { key: 'weekRevenue', header: 'Week revenue', render: (r) => money(r.weekRevenue) },
  {
    key: 'applicable',
    header: 'Applicable',
    render: (r) => (
      <div>
        <strong style={{ display: 'block' }}>{money(r.weekApplicable)}</strong>
        <small style={{ color: '#aaa6a0', fontSize: 10 }}>
          {r.weekRevenue ? `${((r.weekApplicable / r.weekRevenue) * 100).toFixed(1)}% of revenue` : '—'}
        </small>
      </div>
    ),
  },
  { key: 'notApplicable', header: 'Not applicable', render: (r) => money(r.weekNotApplicable) },
  { key: 'impressions', header: 'Impressions', render: (r) => r.weekImpressions.toLocaleString('en-US') },
]

export default function PartnerPaymentsPage() {
  const payments = usePartnerPayments()
  const d = payments.data
  const perf = d?.performance

  const stats = [
    {
      title: 'This week',
      value: money(perf?.week.revenue ?? 0),
      icon: Banknote,
      helper: `${perf?.week.impressions.toLocaleString('en-US') ?? '0'} impressions`,
    },
    {
      title: 'Today',
      value: money(perf?.today.revenue ?? 0),
      icon: CircleDollarSign,
      helper: `${perf?.sitesEarning ?? 0} of ${perf?.totalSites ?? 0} sites earning`,
    },
    {
      title: 'Week applicable',
      value: money(perf?.week.applicable ?? 0),
      icon: Hourglass,
      helper: 'revenue eligible for payment',
    },
    {
      title: 'Week not applicable',
      value: money(perf?.week.notApplicable ?? 0),
      icon: RefreshCw,
      helper: 'excluded from the payment basis',
    },
  ]

  if (payments.isError) {
    return (
      <>
        <PageHeader eyebrow="PARTNER FINANCE" title="Payments" subtitle="Your earnings and payment history." />
        <ErrorPanel message={(payments.error as Error).message} onRetry={() => payments.refetch()} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="PARTNER FINANCE"
        title="Payments"
        subtitle="MCM monthly earnings and your live revenue balance, scoped to the sites tagged to your account."
      />

      <section className="stats-grid" aria-label="Payment summary">
        {payments.isLoading && !d
          ? Array.from({ length: 4 }).map((_, i) => (
              <div className="stat-card" key={i}>
                <LoadingRows rows={1} cols={1} />
              </div>
            ))
          : stats.map((s) => <StatCard key={s.title} {...s} />)}
      </section>

      <Panel kicker="CURRENT CYCLE" title="Reporting period">
        {perf ? (
          <>
            <KeyValue
              items={[
                { label: 'First data date', value: d?.meta.firstDataDate ?? '—' },
                { label: 'Last synced', value: d?.meta.lastSyncedAt ?? '—' },
                { label: 'Week revenue', value: money(perf.week.revenue) },
                {
                  label: 'Week applicable',
                  value: money(perf.week.applicable),
                },
                {
                  label: 'Week not applicable',
                  value: (
                    <span style={{ color: perf.week.notApplicable > 0 ? '#c97258' : undefined }}>
                      {money(perf.week.notApplicable)}
                    </span>
                  ),
                },
                {
                  label: 'iOS impression share',
                  value: perf.week.iosSharePct ? `${perf.week.iosSharePct.toFixed(1)}%` : '—',
                },
                { label: 'Sites earning', value: `${perf.sitesEarning} / ${perf.totalSites}` },
              ]}
            />
            <p className="form-note">
              Applicable revenue is the portion of earnings that counts toward your payment basis.
              Not-applicable revenue is withheld under the traffic-quality rules and is shown
              separately so the difference is visible rather than netted off silently.
            </p>
          </>
        ) : (
          <LoadingRows rows={4} cols={2} />
        )}
      </Panel>

      <Panel
        kicker="MCM MONTHLY REPORT"
        title="Monthly earnings"
        actions={<span className="live-status"><span className="live-dot" />{d?.earnings.length ?? 0} months</span>}
      >
        {payments.isLoading && !d ? (
          <LoadingRows rows={4} cols={7} />
        ) : d && d.earnings.length === 0 ? (
          <EmptyView
            title="No monthly statement yet"
            description="MCM earnings are written here once a month closes and the statement is issued. Your live applicable and not-applicable revenue is shown above in the meantime."
            icon={CreditCard}
          />
        ) : (
          <DataTable
            columns={earningsColumns}
            rows={d?.earnings ?? []}
            rowKey={(r) => `${r.month}-${r.childNetworkCode}`}
            empty="No MCM earnings recorded."
          />
        )}
      </Panel>

      <Panel kicker="TOP EARNING SITES" title="Where this week's revenue came from">
        {payments.isLoading && !d ? (
          <LoadingRows rows={5} cols={6} />
        ) : d && d.topSites.length === 0 ? (
          <div className="table-empty">No site has reported revenue this week.</div>
        ) : (
          <DataTable
            columns={topSiteColumns}
            rows={d?.topSites ?? []}
            rowKey={(r) => r.networkCode}
            empty="No site has reported revenue this week."
          />
        )}
      </Panel>
    </>
  )
}
