'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react'
import { Field, PageHeader, Select } from '@/components/kit'

const DELEGATION_OPTIONS = [
  { value: 'MANAGE_ACCOUNT', label: 'MANAGE_ACCOUNT · Managed by AdGlobeX' },
]

/** Used until /api/p/partner answers; the cap then clamps this down. */
const DEFAULT_CHILD_SHARE = 10

type Phase = 'form' | 'sending' | 'blocked' | 'done'

export default function NewPublisherPage() {
  const router = useRouter()

  const [site, setSite] = useState('')
  const [gamEmail, setGamEmail] = useState('')
  const [networkCode, setNetworkCode] = useState('')
  const [childShare, setChildShare] = useState<number | ''>(DEFAULT_CHILD_SHARE)
  const [maxShare, setMaxShare] = useState(100)
  const [delegationType, setDelegationType] = useState('MANAGE_ACCOUNT')

  const [phase, setPhase] = useState<Phase>('form')
  const [error, setError] = useState('')

  /**
   * The ceiling comes from `partners.max_revenue_share`, set by the admin when
   * this partner was created. Until it lands the share is unbounded, then
   * clamps — and the current value is pulled back inside the new range so the
   * form never holds a share the server would reject.
   */
  useEffect(() => {
    let cancelled = false
    fetch('/api/p/partner')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        const cap = typeof data.maxRevenueShare === 'number' && data.maxRevenueShare > 0
          ? Math.min(100, Math.round(data.maxRevenueShare))
          : 100
        setMaxShare(cap)
        setChildShare((prev) => (typeof prev === 'number' ? Math.min(prev, cap) : cap))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const host = useMemo(() => {
    const trimmed = site.trim()
    if (!trimmed) return ''
    const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    return withoutScheme.split('/')[0].split('?')[0].split('#')[0].replace(/^www\./i, '').replace(/\.$/, '').toLowerCase()
  }, [site])

  const shareValid = typeof childShare === 'number' && !Number.isNaN(childShare) && childShare >= 1 && childShare <= maxShare
  const fieldsFilled = Boolean(host && gamEmail && networkCode.replace(/\D/g, '') && delegationType && shareValid)

  function resetForm() {
    setSite('')
    setGamEmail('')
    setNetworkCode('')
    setChildShare(Math.min(DEFAULT_CHILD_SHARE, maxShare))
    setDelegationType('MANAGE_ACCOUNT')
    setError('')
    setPhase('form')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!fieldsFilled || phase === 'sending') return
    setPhase('sending')
    setError('')

    try {
      const res = await fetch('/api/p/publishers/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site,
          gamEmail,
          networkCode,
          childShare: typeof childShare === 'number' ? childShare : Number(childShare),
          delegationType,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.status === 409) {
        setError(data.error || 'This publisher already exists. Contact the admin.')
        setPhase('blocked')
        return
      }
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        setPhase('blocked')
        return
      }
      setPhase('done')
    } catch {
      setError('Network error. Please try again.')
      setPhase('blocked')
    }
  }

  /* ------------------------------ result cards ------------------------------ */

  if (phase === 'blocked') {
    return (
      <>
        <Link className="back-link" href="/p/publishers">← Manage publishers</Link>
        <section className="panel result-card result-card-blocked">
          <AlertCircle className="result-icon" />
          <h2>Publisher already exists</h2>
          <p>{error}</p>
          <div className="form-actions">
            <Link className="secondary-button" href="/p/tickets">Open a support ticket</Link>
            <button className="primary-button" type="button" onClick={() => { resetForm(); router.refresh() }}>
              Try another publisher
            </button>
          </div>
        </section>
      </>
    )
  }

  if (phase === 'done') {
    return (
      <>
        <Link className="back-link" href="/p/publishers">← Manage publishers</Link>
        <section className="panel result-card">
          <CheckCircle2 className="result-icon result-icon-ok" />
          <h2>Application submitted</h2>
          <p>
            An invitation has been sent to <strong>{gamEmail}</strong>. Check the mailbox — the
            invitation has to be accepted from that address.
          </p>
          <div className="form-actions">
            <Link className="secondary-button" href="/p/publishers/requests">
              View my requests <ExternalLink />
            </Link>
            <button className="primary-button" type="button" onClick={resetForm}>
              Submit another
            </button>
          </div>
        </section>
      </>
    )
  }

  /* ---------------------------------- form --------------------------------- */

  return (
    <>
      <Link className="back-link" href="/p/publishers">← Manage publishers</Link>

      <PageHeader
        eyebrow="ONBOARDING"
        title="Add publisher"
        subtitle="Every submission is checked against the live inventory before anything is sent to GAM. If the Publisher is already held by any partner, the request is recorded and routed to the operations team."
        actions={
          <Link className="secondary-button" href="/p/publishers/requests">
            My requests <ExternalLink />
          </Link>
        }
      />

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">PUBLISHER RECORD</p>
            <h2>Site and commercial details</h2>
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="span-2">
              <Field
                label="Website"
                hint={host ? `The invitation will be labelled <YOUR TAG>-${host}.` : 'The domain the publisher runs.'}
              >
                <input
                  className="input"
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
                  placeholder="https://example.com"
                  autoComplete="url"
                  required
                />
              </Field>
            </div>

            <Field label="Publisher email" hint="The invitation is sent here and must be accepted from it.">
              <input
                className="input"
                type="email"
                value={gamEmail}
                onChange={(e) => setGamEmail(e.target.value)}
                placeholder="ops@publisher.com"
                autoComplete="email"
                required
              />
            </Field>

            <Field label="GAM network code" hint="Digits only. This is what gets checked for duplicates.">
              <input
                className="input"
                inputMode="numeric"
                pattern="[0-9]+"
                value={networkCode}
                onChange={(e) => setNetworkCode(e.target.value.replace(/\D/g, ''))}
                placeholder="12345678"
                required
              />
            </Field>

            <Field
              label="Revenue share"
              hint={`Enter the child's share. Your account is capped at ${maxShare}%.`}
            >
              <input
                className="input"
                type="number"
                min={1}
                max={maxShare}
                step={1}
                value={childShare}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '') {
                    setChildShare('')
                    return
                  }
                  const num = Number(val)
                  if (Number.isNaN(num)) return
                  if (num > maxShare) {
                    setChildShare(maxShare)
                  } else {
                    setChildShare(num)
                  }
                }}
                onBlur={() => {
                  if (childShare === '' || Number(childShare) < 1) {
                    setChildShare(1)
                  } else if (Number(childShare) > maxShare) {
                    setChildShare(maxShare)
                  }
                }}
                placeholder="10"
                required
              />
            </Field>

            <Field label="Delegation type">
              <Select value={delegationType} onChange={setDelegationType} options={DELEGATION_OPTIONS} />
            </Field>
          </div>

          <div className="form-actions">
            <Link className="secondary-button" href="/p/publishers">Cancel</Link>
            <button
              className="primary-button"
              type="submit"
              disabled={!fieldsFilled || phase === 'sending'}
            >
              {phase === 'sending' ? 'Submitting…' : 'Submit application'}
            </button>
          </div>
        </form>
      </section>
    </>
  )
}
