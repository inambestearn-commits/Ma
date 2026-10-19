'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send } from 'lucide-react'
import { ErrorPanel, Field, PageHeader, Panel, Select } from '@/components/kit'
import { useCreateTicket } from '@/lib/partner-api'
import {
  CATEGORY_LABELS, PRIORITY_LABELS, TICKET_CATEGORIES, TICKET_PRIORITIES,
} from '@/lib/tickets'

export default function NewTicketPage() {
  const router = useRouter()
  const create = useCreateTicket()

  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('TECHNICAL')
  const [priority, setPriority] = useState('NORMAL')
  const [description, setDescription] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFieldErrors({})
    try {
      const { ticketId } = await create.mutateAsync({ subject, description, category, priority })
      router.push(`/p/tickets/${encodeURIComponent(ticketId)}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not file the ticket'
      setFieldErrors({ _form: message })
    }
  }

  const dirty = subject.trim() !== '' || description.trim() !== ''

  return (
    <>
      <PageHeader
        eyebrow="SUPPORT"
        title="New ticket"
        subtitle="Tell us what you need help with. Your partner tag is attached automatically, so support can pull up the right sites without you repeating them."
        actions={
          <Link className="secondary-button" href="/p/tickets">
            <ArrowLeft /> Back to tickets
          </Link>
        }
      />

      <div className="detail-grid">
        <Panel kicker="TICKET" title="What do you need help with?">
          <form onSubmit={submit}>
            {fieldErrors._form ? (
              <p className="auth-error" role="alert" style={{ marginBottom: 14 }}>
                {fieldErrors._form}
              </p>
            ) : null}

            <Field label="Subject" hint="A short summary, e.g. “Revenue missing for 8 Oct”.">
              <input
                className="input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                required
                placeholder="Revenue missing for 8 Oct"
              />
            </Field>

            <div className="form-grid">
              <Field label="Category">
                <Select
                  value={category}
                  onChange={setCategory}
                  options={TICKET_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
                />
              </Field>
              <Field label="Priority" hint="Urgent is for revenue-affecting outages.">
                <Select
                  value={priority}
                  onChange={setPriority}
                  options={TICKET_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
                />
              </Field>
            </div>

            <Field
              label="Description"
              hint="Include network codes, dates and figures where you can — it usually saves a round trip."
            >
              <textarea
                className="input textarea"
                rows={8}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={8000}
                required
                placeholder={'What happened, which sites are affected, and what you expected instead.'}
              />
            </Field>

            <div className="form-actions">
              <Link className="secondary-button" href="/p/tickets">Cancel</Link>
              <button
                className="primary-button"
                type="submit"
                disabled={create.isPending || !subject.trim() || !description.trim()}
                style={
                  create.isPending || !subject.trim() || !description.trim()
                    ? { opacity: 0.55, cursor: 'not-allowed' }
                    : undefined
                }
              >
                <Send /> {create.isPending ? 'Filing…' : 'File ticket'}
              </button>
            </div>
          </form>
        </Panel>

        <Panel kicker="GOOD TO KNOW" title="What happens next">
          <ul style={{ margin: 0, paddingLeft: 18, color: '#5d5b57', fontSize: 12, lineHeight: 1.8 }}>
            <li>Your partner tag is written to the ticket from your session — you never select it.</li>
            <li>You can reply on the ticket thread and the whole conversation stays in one place.</li>
            <li>Replying to a resolved ticket reopens it automatically.</li>
            <li>Closed tickets cannot be replied to; file a new one to start fresh.</li>
          </ul>
          {dirty ? (
            <p className="form-note" style={{ marginTop: 16 }}>
              You have unsaved text. Leaving this page discards it.
            </p>
          ) : null}
        </Panel>
      </div>
    </>
  )
}
