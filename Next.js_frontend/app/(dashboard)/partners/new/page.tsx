'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Field, PageHeader } from '@/components/kit'
import { ApiError, createPartner } from '@/lib/api'

export default function NewPartnerPage() {
  const router = useRouter()
  const [ticket, setTicket] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [maxShare, setMaxShare] = useState(10)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdTicket, setCreatedTicket] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const partner = await createPartner({
        ticket: ticket.trim(),
        name: name.trim(),
        email: email.trim(),
        password,
        max_revenue_share: maxShare,
      })
      setCreatedTicket(partner.partner_ticket)
      window.setTimeout(() => router.push('/partners'), 900)
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'Partner creation failed unexpectedly. Check connectivity and try again.'
      setError(message)
      setBusy(false)
    }
  }

  return (
    <>
      <Link className="back-link" href="/partners">← All partners</Link>

      <PageHeader
        eyebrow="ONBOARDING"
        title="Create partner"
        subtitle="Provision a new tenant: Supabase login with partner-tag access plus BigQuery identity records."
      />

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">TENANT RECORD</p>
            <h2>Commercial and login details</h2>
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="form-grid">
            <Field
              label="Partner ticket"
              hint="Unique and immutable after creation. Lowercased into the partner tag that gates portal access."
            >
              <input
                className="input"
                value={ticket}
                onChange={(e) => setTicket(e.target.value)}
                placeholder="AGX-1009"
                pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,39}"
                title="2-40 characters: letters, digits, hyphen or underscore, starting with a letter or digit."
                required
              />
            </Field>

            <Field label="Partner name">
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Northstar Publishing"
                autoComplete="organization"
                required
              />
            </Field>

            <Field label="Login email" hint="Becomes the partner admin's Supabase sign-in email.">
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ops@partner.com"
                autoComplete="email"
                required
              />
            </Field>

            <Field
              label="Initial password"
              hint="Delivered to the partner out of band. Minimum 8 characters."
            >
              <input
                className="input"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </Field>

            <Field
              label="Maximum share ratio"
              hint="Upper bound for the partner's share, percent (0-100). Stored on the partner record."
            >
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={maxShare}
                onChange={(e) => setMaxShare(Number(e.target.value))}
                required
              />
            </Field>
          </div>

          <p className="form-note">
            Creating the partner provisions the Supabase account and grants it the PARTNER_ADMIN
            role immediately — the contact can sign in at the partner portal right away. Sites
            appear after the next GAM sync delivers inventory under this partner&apos;s label.
          </p>

          {error ? (
            <p className="field-hint" role="alert" style={{ marginTop: 14, color: 'var(--danger, #b42318)' }}>
              {error}
            </p>
          ) : null}

          {createdTicket ? (
            <p className="field-hint" role="status" style={{ marginTop: 14 }}>
              Partner {createdTicket} provisioned with a {maxShare}% maximum share. Redirecting to the directory…
            </p>
          ) : null}

          <div className="form-actions">
            <Link className="secondary-button" href="/partners">Cancel</Link>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? 'Creating partner…' : 'Create partner'}
            </button>
          </div>
        </form>
      </section>
    </>
  )
}
