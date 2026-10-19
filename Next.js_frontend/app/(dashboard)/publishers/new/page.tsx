'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Field, PageHeader, Select } from '@/components/kit'

const mcmOptions = [{ value: 'MCM-001', label: 'MCM-001 · GAM Primary' }]

export default function NewPublisherPage() {
  const router = useRouter()
  const [site, setSite] = useState('')
  const [email, setEmail] = useState('')
  const [networkCode, setNetworkCode] = useState('')
  const [revenueShare, setRevenueShare] = useState(10)
  const [mcm, setMcm] = useState('MCM-001')
  const [note, setNote] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    router.push('/publishers')
  }

  return (
    <>
      <Link className="back-link" href="/publishers">← Manage publishers</Link>

      <PageHeader
        eyebrow="ONBOARDING"
        title="Add publisher"
        subtitle="Submit a site for onboarding into your partner scope. Validation, duplicate ownership check and policy pre-check run server-side before the invite is queued (Appendix C.1)."
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
            <Field
              label="Site URL"
              hint="Canonicalised and normalised server-side before the ownership lookup."
            >
              <input
                className="input"
                value={site}
                onChange={(e) => setSite(e.target.value)}
                placeholder="https://example.com"
                autoComplete="url"
              />
            </Field>

            <Field label="Publisher email" hint="Used for onboarding notifications.">
              <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ops@publisher.com"
                autoComplete="email"
              />
            </Field>

            <Field label="GAM / network code">
              <input
                className="input"
                inputMode="numeric"
                value={networkCode}
                onChange={(e) => setNetworkCode(e.target.value)}
                placeholder="12345678"
              />
            </Field>

            <Field
              label="Revenue share"
              hint="Stored as a formal rule, e.g. 10 parent + 90 child (BR-006)."
            >
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={revenueShare}
                onChange={(e) => setRevenueShare(Number(e.target.value))}
              />
            </Field>

            <Field
              label="MCM"
              hint="Phase 1 ships one active MCM so it is preselected; the field already accepts an mcm_connection_id for future connections (§13.2, §32.2)."
            >
              <Select value={mcm} onChange={setMcm} options={mcmOptions} />
            </Field>

            <div className="span-2">
              <Field label="Note">
                <textarea
                  className="textarea"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note for the operations team."
                />
              </Field>
            </div>
          </div>

          <p className="form-note">
            Duplicate protection (BR-004): if the site is already owned by another partner, the
            response is a generic "this publisher cannot be onboarded right now" — the owning
            partner's name, ticket, email, revenue and metadata are never disclosed.
          </p>

          <div className="form-actions">
            <Link className="secondary-button" href="/publishers">Cancel</Link>
            <button className="primary-button" type="submit">Send invite</button>
          </div>
        </form>
      </section>
    </>
  )
}
