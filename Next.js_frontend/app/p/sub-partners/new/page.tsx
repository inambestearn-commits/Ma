'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { Field, PageHeader } from '@/components/kit'
import { useCreateSubPartner } from '@/lib/partner-api'

const DEFAULT_SHARE = 10

export default function NewSubPartnerPage() {
  const create = useCreateSubPartner()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [revenueShare, setRevenueShare] = useState<number | ''>(DEFAULT_SHARE)
  const [minShare, setMinShare] = useState(1)

  const [phase, setPhase] = useState<'form' | 'done' | 'error'>('form')
  const [errorMsg, setErrorMsg] = useState('')
  const [created, setCreated] = useState<{ subTicket: string; subTag: string } | null>(null)

  /* The floor is resolved server-side from the admin cap on this account. */
  useEffect(() => {
    fetch('/api/p/partner')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return
        const raw = data.minParentShare
        if (typeof raw === 'number' && raw > 0) {
          const min = Math.round(raw)
          setMinShare(min)
          setRevenueShare((prev) =>
            typeof prev === 'number' ? Math.max(prev, min) : min,
          )
        }
      })
      .catch(() => {})
  }, [])

  const shareValid =
    typeof revenueShare === 'number' &&
    !Number.isNaN(revenueShare) &&
    revenueShare >= minShare &&
    revenueShare <= 99

  const canSubmit =
    name.trim() !== '' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    password.length >= 8 &&
    shareValid &&
    !create.isPending

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setErrorMsg('')
    try {
      const result = await create.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        password,
        revenueShare: typeof revenueShare === 'number' ? revenueShare : Number(revenueShare),
      })
      setCreated({ subTicket: result.subTicket, subTag: result.subTag })
      setPhase('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Creation failed. Please try again.')
      setPhase('error')
    }
  }

  /* ── Success card ── */
  if (phase === 'done' && created) {
    return (
      <>
        <Link className="back-link" href="/p/sub-partners">← Sub partners</Link>
        <section className="panel result-card">
          <CheckCircle2 className="result-icon result-icon-ok" />
          <h2>Sub partner created</h2>
          <p>
            <strong>{name}</strong> has been provisioned with ticket{' '}
            <code
              style={{
                background: '#f2efe9',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 13,
              }}
            >
              {created.subTicket}
            </code>
            . They can sign in at the partner portal immediately using the email and password you set.
          </p>
          <p style={{ fontSize: 12, color: '#a5a19b', marginTop: 6 }}>
            Partner tag: <code>{created.subTag}</code> · Revenue ratio: {revenueShare}%
          </p>
          <div className="form-actions">
            <Link className="secondary-button" href="/p/sub-partners">
              View all sub partners
            </Link>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setName('')
                setEmail('')
                setPassword('')
                setRevenueShare(Math.max(DEFAULT_SHARE, minShare))
                setPhase('form')
                setCreated(null)
              }}
            >
              Create another
            </button>
          </div>
        </section>
      </>
    )
  }

  /* ── Error card ── */
  if (phase === 'error') {
    return (
      <>
        <Link className="back-link" href="/p/sub-partners">← Sub partners</Link>
        <section className="panel result-card result-card-blocked">
          <AlertCircle className="result-icon" />
          <h2>Creation failed</h2>
          <p>{errorMsg}</p>
          <div className="form-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => setPhase('form')}
            >
              Try again
            </button>
          </div>
        </section>
      </>
    )
  }

  /* ── Form ── */
  return (
    <>
      <Link className="back-link" href="/p/sub-partners">← Sub partners</Link>

      <PageHeader
        eyebrow="NETWORK"
        title="Create sub partner"
        subtitle="Sub partners share your network under their own tag. They log in to the same portal and see only their own sites and revenue."
      />

      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">SUB PARTNER RECORD</p>
            <h2>Account details</h2>
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="span-2">
              <Field label="Full name" hint="Name of the sub partner company or contact.">
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Northstar Media"
                  required
                />
              </Field>
            </div>

            <Field label="Login email" hint="The sub partner will use this to sign in.">
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ops@subpartner.com"
                autoComplete="email"
                required
              />
            </Field>

            <Field
              label="Initial password"
              hint="Share this with the sub partner out of band. Minimum 8 characters."
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
              label="Revenue share (parent %)"
              hint={`Your share of this sub partner's revenue. Minimum ${minShare}% based on your account.`}
            >
              <input
                className="input"
                type="number"
                min={minShare}
                max={99}
                step={1}
                value={revenueShare}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '') { setRevenueShare(''); return }
                  const num = Number(val)
                  if (Number.isNaN(num)) return
                  setRevenueShare(num > 99 ? 99 : num)
                }}
                onBlur={() => {
                  if (revenueShare === '' || Number(revenueShare) < minShare) {
                    setRevenueShare(minShare)
                  } else if (Number(revenueShare) > 99) {
                    setRevenueShare(99)
                  }
                }}
                placeholder={String(Math.max(DEFAULT_SHARE, minShare))}
                required
              />
            </Field>

          </div>

          {errorMsg && phase === 'form' ? (
            <p className="auth-error" role="alert" style={{ marginTop: 14 }}>
              {errorMsg}
            </p>
          ) : null}

          <div className="form-actions">
            <Link className="secondary-button" href="/p/sub-partners">Cancel</Link>
            <button
              className="primary-button"
              type="submit"
              disabled={!canSubmit}
              style={!canSubmit ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
            >
              {create.isPending ? 'Creating…' : 'Create sub partner'}
            </button>
          </div>
        </form>
      </section>
    </>
  )
}
