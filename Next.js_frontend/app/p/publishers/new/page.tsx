'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react'
import { Field, PageHeader, Select } from '@/components/kit'

const DELEGATION_OPTIONS = [
  { value: 'MANAGE_ACCOUNT', label: 'MANAGE_ACCOUNT · Managed by AdGlobeX' },
]

/** Default parent share in percent (10% parent, 90% child). */
const DEFAULT_PARENT_SHARE = 10

type Phase = 'form' | 'sending' | 'blocked' | 'done'

export default function NewPublisherPage() {
  const router = useRouter()

  const [site, setSite] = useState('')
  const [gamEmail, setGamEmail] = useState('')
  const [networkCode, setNetworkCode] = useState('')
  const [parentShare, setParentShare] = useState<number | ''>(DEFAULT_PARENT_SHARE)
  const [minShare, setMinShare] = useState(1)
  const [delegationType, setDelegationType] = useState('MANAGE_ACCOUNT')

  const [phase, setPhase] = useState<Phase>('form')
  const [error, setError] = useState('')

  /**
   * The commercial floor comes from `partners.max_revenue_share`, set by the admin when
   * this partner was created. The partner cannot offer less than their account floor.
   */
  useEffect(() => {
    let cancelled = false
    fetch('/api/p/partner')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        const raw = data.maxRevenueShare
        if (typeof raw === 'number' && raw > 0) {
          const min = raw > 50 ? Math.max(1, 100 - Math.round(raw)) : Math.round(raw)
          setMinShare(min)
          setParentShare((prev) => (typeof prev === 'number' ? Math.max(prev, min) : min))
        }
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

  const shareValid = typeof parentShare === 'number' && !Number.isNaN(parentShare) && parentShare >= minShare && parentShare <= 99
  const fieldsFilled = Boolean(host && gamEmail && networkCode.replace(/\D/g, '') && delegationType && shareValid)

  function resetForm() {
    setSite('')
    setGamEmail('')
    setNetworkCode('')
    setParentShare(Math.max(DEFAULT_PARENT_SHARE, minShare))
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
      const numParent = typeof parentShare === 'number' ? parentShare : Number(parentShare)
      const res = await fetch('/api/p/publishers/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site,
          gamEmail,
          networkCode,
          childShare: 100 - numParent,
          parentShare: numParent,
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
    const isDuplicate = error.toLowerCase().includes('already exists')
    return (
      <>
        <Link className="back-link" href="/p/publishers">← Manage publishers</Link>
        <section className="panel result-card result-card-blocked">
          <AlertCircle className="result-icon" />
          <h2>{isDuplicate ? 'Publisher already exists' : 'Submission blocked'}</h2>
          <p>{error}</p>
          <div className="form-actions">
            <Link className="secondary-button" href="/p/tickets">Open a support ticket</Link>
            <button className="primary-button" type="button" onClick={() => { resetForm(); router.refresh() }}>
              {isDuplicate ? 'Try another publisher' : 'Try again'}
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
              hint={`Parent share. Your account requires at least ${minShare}%.`}
            >
              <input
                className="input"
                type="number"
                min={minShare}
                max={99}
                step={1}
                value={parentShare}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '') {
                    setParentShare('')
                    return
                  }
                  const num = Number(val)
                  if (Number.isNaN(num)) return
                  if (num > 99) {
                    setParentShare(99)
                  } else {
                    setParentShare(num)
                  }
                }}
                onBlur={() => {
                  if (parentShare === '' || Number(parentShare) < minShare) {
                    setParentShare(minShare)
                  } else if (Number(parentShare) > 99) {
                    setParentShare(99)
                  }
                }}
                placeholder={String(Math.max(DEFAULT_PARENT_SHARE, minShare))}
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
