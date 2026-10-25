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
      const message = err instanceof Error ? err.message : 'Could not submit your ticket. Please try again.'
      setFieldErrors({ _form: message })
    }
  }

  const dirty = subject.trim() !== '' || description.trim() !== ''

  return (
    <>
      <PageHeader
        eyebrow="SUPPORT"
        title="New ticket"
        subtitle="Need help or have questions? Submit a support request and our team will get back to you promptly."
        actions={
          <Link className="secondary-button" href="/p/tickets">
            <ArrowLeft /> Back to tickets
          </Link>
        }
      />

      <div className="detail-grid">
        <Panel kicker="SUPPORT REQUEST" title="Ticket details">
          <form onSubmit={submit}>
            {fieldErrors._form ? (
              <p className="auth-error" role="alert" style={{ marginBottom: 14 }}>
                {fieldErrors._form}
              </p>
            ) : null}

            <Field label="Subject" hint="A clear, concise summary of what you need assistance with.">
              <input
                className="input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={200}
                required
                placeholder="e.g. Question about monthly earnings or setup"
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
              <Field label="Priority" hint="Select Urgent only for critical, time-sensitive issues.">
                <Select
                  value={priority}
                  onChange={setPriority}
                  options={TICKET_PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }))}
                />
              </Field>
            </div>

            <Field
              label="Description"
              hint="Please provide details, relevant URLs, dates, or error messages to help us resolve this quickly."
            >
              <textarea
                className="input textarea"
                rows={8}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={8000}
                required
                placeholder="Describe your issue or question in detail..."
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
                <Send /> {create.isPending ? 'Submitting…' : 'Submit ticket'}
              </button>
            </div>
          </form>
        </Panel>

        <Panel kicker="HELP & TIPS" title="What to expect">
          <ul style={{ margin: 0, paddingLeft: 18, color: '#5d5b57', fontSize: 12, lineHeight: 1.8 }}>
            <li>Your account details are automatically linked, so our support team has immediate context.</li>
            <li>You can reply directly within the ticket thread to keep all communication in one place.</li>
            <li>If an issue resurfaces after being marked resolved, replying will reopen it automatically.</li>
            <li>Closed tickets cannot receive new replies; please create a new ticket for new requests.</li>
          </ul>
          {dirty ? (
            <p className="form-note" style={{ marginTop: 16 }}>
              You have unsaved changes. Leaving this page will discard them.
            </p>
          ) : null}
        </Panel>
      </div>
    </>
  )
}
