'use client'

import { useEffect, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, ChevronDown, MoreHorizontal, Search, X } from 'lucide-react'

/* ------------------------------- PageHeader ------------------------------- */

export function PageHeader({
  eyebrow, title, subtitle, actions,
}: { eyebrow: string; title: string; subtitle: string; actions?: React.ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="heading-subtitle">{subtitle}</p>
      </div>
      {actions ? <div className="heading-actions">{actions}</div> : null}
    </div>
  )
}

/* -------------------------------- StatCard -------------------------------- */

export function StatCard({
  title, value, change, icon: Icon, negative = false, helper = 'vs. last 30 days',
}: {
  title: string
  value: string
  change?: string
  icon: React.ComponentType<{ className?: string }>
  negative?: boolean
  helper?: string
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <div className="stat-icon"><Icon /></div>
        <button className="icon-button" aria-label={`More ${title} options`}><MoreHorizontal /></button>
      </div>
      <p className="stat-label">{title}</p>
      <div className="stat-value-row">
        <p className="stat-value">{value}</p>
        {change ? (
          <span className={negative ? 'trend negative' : 'trend positive'}>
            {negative ? <ArrowDownRight /> : <ArrowUpRight />}{change}
          </span>
        ) : null}
      </div>
      <p className="stat-helper">{helper}</p>
    </div>
  )
}

/* --------------------------------- Status --------------------------------- */

export const statusSlug = (value: string) =>
  value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function Status({ value }: { value: string }) {
  return <span className={`status status-${statusSlug(value)}`}><i />{value}</span>
}

export function Pill({ value }: { value: string }) {
  return <span className="pill">{value}</span>
}

/* --------------------------------- Panels --------------------------------- */

export function Panel({
  kicker, title, actions, children, className = '',
}: {
  kicker?: string
  title?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`panel ${className}`.trim()}>
      {title || actions ? (
        <div className="panel-heading">
          <div>
            {kicker ? <p className="panel-kicker">{kicker}</p> : null}
            {title ? <h2>{title}</h2> : null}
          </div>
          {actions ? <div className="table-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function EmptyView({
  title, description, action, icon: Icon, onAction,
}: {
  title: string
  description: string
  action?: string
  icon?: React.ComponentType<{ className?: string }>
  onAction?: () => void
}) {
  const Glyph = Icon ?? Search
  return (
    <section className="panel empty-view">
      <div className="empty-icon"><Glyph /></div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? (
        <button className="primary-button" onClick={onAction}>{action}</button>
      ) : null}
    </section>
  )
}

/* ------------------------------- Tabs / Chips ----------------------------- */

export interface TabDef { label: string; value: string; count?: number }

export function Tabs({
  tabs, active, onChange,
}: { tabs: TabDef[]; active: string; onChange: (v: string) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={active === t.value}
          className={active === t.value ? 'tab active' : 'tab'}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {typeof t.count === 'number' ? <span className="tab-count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

export function Chip({ tone = 'neutral', children }: { tone?: string; children: React.ReactNode }) {
  return <span className={`chip chip-${tone}`}>{children}</span>
}

/* -------------------------------- Search ---------------------------------- */

export function SearchField({
  value, onChange, placeholder = 'Search',
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="search-field">
      <Search />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        <button className="clear-search" onClick={() => onChange('')} aria-label="Clear search"><X /></button>
      ) : null}
    </div>
  )
}

/* --------------------------------- Modal ---------------------------------- */

export function Modal({
  open, onClose, title, copy, children, actions,
}: {
  open: boolean
  onClose: () => void
  title: string
  copy?: string
  children?: React.ReactNode
  actions?: React.ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>
        <p className="panel-kicker">CONFIRM</p>
        <h2>{title}</h2>
        {copy ? <p className="modal-copy">{copy}</p> : null}
        {children}
        {actions ? <div className="modal-actions">{actions}</div> : null}
      </div>
    </div>
  )
}

/* ------------------------------- Date picker ------------------------------ */

export function DateSelector({ label, options = ['Last 7 days', 'Last 30 days', 'Quarter to date', 'Year to date'] }: {
  label: string
  options?: string[]
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(label)
  return (
    <div className="date-select-wrap">
      <button className="date-selector" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>{value}</span><ChevronDown />
      </button>
      {open ? (
        <div className="date-menu" role="menu">
          {options.map((o) => (
            <button
              key={o}
              role="menuitem"
              aria-current={o === value ? 'true' : undefined}
              onClick={() => { setValue(o); setOpen(false) }}
            >
              {o}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function LiveStatus({ children }: { children: React.ReactNode }) {
  return <span className="live-status"><span className="live-dot" />{children}</span>
}

export function FilterRow({ children }: { children: React.ReactNode }) {
  return <div className="filter-row">{children}</div>
}

/* ------------------------------ Data table -------------------------------- */

export interface Column<T> {
  key: string
  header: string
  render: (row: T) => React.ReactNode
  width?: string
}

export function DataTable<T>({
  columns, rows, rowKey, onRowClick, empty = 'No records match your filters.',
}: {
  columns: Column<T>[]
  rows: T[]
  /**
   * Stable React key for a row. The index is passed as a fallback for callers
   * whose natural key can collapse to a blank/constant value — e.g. the
   * Overview reporting tab requests no dimensions, so every label is empty.
   */
  rowKey: (row: T, index: number) => string
  onRowClick?: (row: T) => void
  empty?: string
}) {
  if (rows.length === 0) {
    return <div className="table-empty">{empty}</div>
  }
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={c.width ? { width: c.width } : undefined}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              className={onRowClick ? 'clickable' : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((c) => <td key={c.key}>{c.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Pagination({ page, pageSize, count, onPage }: {
  page: number; pageSize: number; count: number; onPage: (p: number) => void
}) {
  const pages = Math.max(1, Math.ceil(count / pageSize))
  if (pages <= 1) return <div className="pagination muted">Showing {count} of {count}</div>
  return (
    <div className="pagination">
      <span>{count} records · page {page} of {pages}</span>
      <div className="pagination-buttons">
        <button className="secondary-button" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button className="secondary-button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  )
}

/* --------------------------------- Forms ---------------------------------- */

export function Field({
  label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="form-field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

export function Select({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

/* ------------------------------- Key / Value ------------------------------ */

export function KeyValue({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="kv">
      {items.map((i) => (
        <div className="kv-row" key={i.label}>
          <dt>{i.label}</dt>
          <dd>{i.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/* ------------------------------- Bar / List ------------------------------- */

export function BarList({ items }: { items: { label: string; value: number; display?: string }[] }) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <div className="bar-list">
      {items.map((i) => (
        <div className="bar-item" key={i.label}>
          <div className="bar-meta"><span>{i.label}</span><strong>{i.display ?? i.value.toLocaleString()}</strong></div>
          <div className="bar-track"><i style={{ width: `${Math.round((i.value / max) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

/* -------------------------------- Trend chart ----------------------------- */

/**
 * Bar chart. Pass `secondary` to draw a second, muted bar per column (used by
 * the partner home page to pair revenue with impressions). Each series is
 * scaled to its own maximum, so a small secondary metric is still readable
 * next to a large primary one.
 */
export function TrendChart({
  data,
  secondary,
}: {
  data: { label: string; value: number }[]
  secondary?: { label: string; value: number }[]
}) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const max2 = secondary ? Math.max(...secondary.map((d) => d.value), 1) : 1
  const fmt = (n: number) => n.toLocaleString('en-US')

  return (
    <div className="trend-chart" role="img" aria-label="Trend chart">
      {data.map((d, i) => {
        const s = secondary?.[i]
        return (
          <div
            className="trend-col"
            key={d.label}
            title={s ? `${d.label}: ${fmt(d.value)} · ${fmt(s.value)}` : `${d.label}: ${fmt(d.value)}`}
          >
            <span className="trend-tip">
              {fmt(d.value)}
              {s ? ` · ${fmt(s.value)}` : ''}
            </span>
            <span className="trend-bars">
              <span className="trend-bar" style={{ height: `${Math.max(6, (d.value / max) * 100)}%` }} />
              {s ? (
                <span
                  className="trend-bar trend-bar-secondary"
                  style={{ height: `${Math.max(6, (s.value / max2) * 100)}%` }}
                />
              ) : null}
            </span>
            <small>{d.label}</small>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------ Loading state ----------------------------- */

export function LoadingRows({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="skeleton-stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div className="skeleton-row" key={r}>
          {Array.from({ length: cols }).map((__, c) => <span className="skeleton" key={c} />)}
        </div>
      ))}
    </div>
  )
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <section className="panel error-panel" role="alert">
      <h2>Could not load this view</h2>
      <p>{message}</p>
      {onRetry ? <button className="secondary-button" onClick={onRetry}>Try again</button> : null}
    </section>
  )
}
