'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Save, ShieldCheck } from 'lucide-react'
import { Field, KeyValue, PageHeader, Panel } from '@/components/kit'
import { createClient } from '@/lib/supabase/client'

const NOTIFICATION_PREFS = [
  { key: 'payment', label: 'Payment released' },
  { key: 'policy', label: 'Policy issue opened' },
  { key: 'smartAlert', label: 'Smart alert triggered' },
  { key: 'invite', label: 'Invite accepted / declined / expired' },
  { key: 'withdrawn', label: 'Publisher withdrawn' },
  { key: 'mcm', label: 'MCM / API error' },
  { key: 'digest', label: 'Weekly digest' },
] as const

type Notice = { kind: 'ok' | 'error'; text: string } | null

export interface SettingsInitial {
  userId: string
  email: string
  partnerTag: string
  fullName: string
  companyName: string
  notificationPrefs: Record<string, boolean>
  createdAt: string
}

export function PartnerSettings({ initial }: { initial: SettingsInitial }) {
  const router = useRouter()
  const supabase = createClient()

  const [fullName, setFullName] = useState(initial.fullName)
  const [company, setCompany] = useState(initial.companyName)
  const [prefs, setPrefs] = useState<Record<string, boolean>>(initial.notificationPrefs)
  const [baseline, setBaseline] = useState({
    fullName: initial.fullName,
    company: initial.companyName,
    prefs: initial.notificationPrefs,
  })

  const [profileNotice, setProfileNotice] = useState<Notice>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  const [prefsNotice, setPrefsNotice] = useState<Notice>(null)
  const [savingPrefs, setSavingPrefs] = useState(false)

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwNotice, setPwNotice] = useState<Notice>(null)
  const [savingPw, setSavingPw] = useState(false)

  const [signOutNotice, setSignOutNotice] = useState<Notice>(null)
  const [signingOut, setSigningOut] = useState(false)

  const profileDirty = fullName !== baseline.fullName || company !== baseline.company
  const prefsDirty = NOTIFICATION_PREFS.some((p) => prefs[p.key] !== baseline.prefs[p.key])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileNotice(null)
    setSavingProfile(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim(), company_name: company.trim() },
      })
      if (error) {
        setProfileNotice({ kind: 'error', text: error.message })
        return
      }
      setBaseline((b) => ({ ...b, fullName: fullName.trim(), company: company.trim() }))
      setProfileNotice({ kind: 'ok', text: 'Profile saved. Your display name updates across the portal immediately.' })
      // The partner shell reads the name server-side from the session, so a
      // refresh is what makes the sidebar pick the new value up.
      router.refresh()
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePrefs(e: React.FormEvent) {
    e.preventDefault()
    setPrefsNotice(null)
    setSavingPrefs(true)
    try {
      const { error } = await supabase.auth.updateUser({ data: { notification_prefs: prefs } })
      if (error) {
        setPrefsNotice({ kind: 'error', text: error.message })
        return
      }
      setBaseline((b) => ({ ...b, prefs }))
      setPrefsNotice({ kind: 'ok', text: 'Notification preferences saved.' })
    } finally {
      setSavingPrefs(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwNotice(null)

    if (newPw.length < 8) {
      setPwNotice({ kind: 'error', text: 'New password must be at least 8 characters.' })
      return
    }
    if (newPw !== confirmPw) {
      setPwNotice({ kind: 'error', text: 'New password and confirmation do not match.' })
      return
    }
    if (newPw === currentPw) {
      setPwNotice({ kind: 'error', text: 'New password must be different from the current one.' })
      return
    }

    setSavingPw(true)
    try {
      // Verify the current password first — Supabase accepts a password change
      // from a session alone, so without this a hijacked session could quietly
      // rotate the credential.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: initial.email,
        password: currentPw,
      })
      if (verifyError) {
        setPwNotice({ kind: 'error', text: 'Current password is incorrect.' })
        return
      }

      const { error } = await supabase.auth.updateUser({ password: newPw })
      if (error) {
        setPwNotice({ kind: 'error', text: error.message })
        return
      }
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      setPwNotice({
        kind: 'ok',
        text: 'Password changed. Other devices stay signed in — use sign out everywhere below to end them.',
      })
    } finally {
      setSavingPw(false)
    }
  }

  async function signOutEverywhere() {
    setSignOutNotice(null)
    setSigningOut(true)
    try {
      // `global` revokes every refresh token, not just this device.
      const { error } = await supabase.auth.signOut({ scope: 'global' })
      if (error) {
        setSignOutNotice({ kind: 'error', text: error.message })
        return
      }
      router.replace('/login')
      router.refresh()
    } finally {
      setSigningOut(false)
    }
  }

  const notice = (n: Notice) =>
    n ? (
      <p className={n.kind === 'ok' ? 'form-note' : 'auth-error'} role={n.kind === 'ok' ? 'status' : 'alert'}>
        {n.text}
      </p>
    ) : null

  return (
    <div className="settings-page">
      <PageHeader
        eyebrow="WORKSPACE"
        title="Settings"
        subtitle={`Profile, security and notification preferences for ${initial.partnerTag.toUpperCase()}. Changes are saved to your account.`}
      />

      <div className="detail-grid">
        <Panel kicker="PROFILE" title="Your details">
          <form onSubmit={saveProfile}>
            <div className="form-grid">
              <Field label="Display name" hint="Shown in the sidebar and top bar.">
                <input
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  placeholder="Northstar Publishing"
                />
              </Field>
              <Field label="Company name">
                <input
                  className="input"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  autoComplete="organization"
                  placeholder="Northstar Publishing Ltd"
                />
              </Field>
            </div>
            {notice(profileNotice)}
            <div className="form-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={!profileDirty}
                style={!profileDirty ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                onClick={() => {
                  setFullName(baseline.fullName)
                  setCompany(baseline.company)
                  setProfileNotice(null)
                }}
              >
                Discard
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={!profileDirty || savingProfile}
                style={!profileDirty || savingProfile ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
              >
                <Save /> {savingProfile ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </form>
        </Panel>

        <Panel kicker="ACCOUNT" title="Workspace identity">
          <KeyValue
            items={[
              { label: 'Partner tag', value: <span className="pill">{initial.partnerTag.toUpperCase()}</span> },
              { label: 'Email', value: initial.email },
              { label: 'Role', value: 'Partner' },
              { label: 'User ID', value: <span className="pill">{initial.userId.slice(0, 8)}</span> },
              {
                label: 'Account created',
                value: initial.createdAt ? initial.createdAt.replace('T', ' ').slice(0, 16) : '—',
              },
            ]}
          />
        </Panel>
      </div>

      <div className="settings-block">
        <Panel kicker="NOTIFICATIONS" title="What we email you about">
          <form onSubmit={savePrefs}>
            <div className="form-grid">
              {NOTIFICATION_PREFS.map((pref) => (
                <label
                  className="field-label"
                  key={pref.key}
                  style={{ display: 'flex', alignItems: 'center', gap: 9 }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(prefs[pref.key])}
                    onChange={(e) => setPrefs((p) => ({ ...p, [pref.key]: e.target.checked }))}
                  />
                  {pref.label}
                </label>
              ))}
            </div>
            {notice(prefsNotice)}
            <div className="form-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={!prefsDirty}
                style={!prefsDirty ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                onClick={() => {
                  setPrefs(baseline.prefs)
                  setPrefsNotice(null)
                }}
              >
                Discard
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={!prefsDirty || savingPrefs}
                style={!prefsDirty || savingPrefs ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
              >
                <Save /> {savingPrefs ? 'Saving…' : 'Save preferences'}
              </button>
            </div>
          </form>
        </Panel>
      </div>

      <div className="detail-grid settings-block">
        <Panel kicker="SECURITY" title="Change password">
          <form onSubmit={changePassword}>
            <div className="form-grid">
              <Field label="Current password">
                <input
                  className="input"
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Field label="New password" hint="Minimum 8 characters.">
                <input
                  className="input"
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </Field>
              <Field label="Confirm new password">
                <input
                  className="input"
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </Field>
            </div>
            {notice(pwNotice)}
            <div className="form-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={savingPw || !currentPw || !newPw || !confirmPw}
                style={
                  savingPw || !currentPw || !newPw || !confirmPw
                    ? { opacity: 0.55, cursor: 'not-allowed' }
                    : undefined
                }
              >
                <ShieldCheck /> {savingPw ? 'Updating…' : 'Change password'}
              </button>
            </div>
          </form>
        </Panel>

        <Panel kicker="SESSIONS" title="Signed-in devices">
          <KeyValue
            items={[
              { label: 'This device', value: 'Signed in now' },
              { label: 'Scope', value: 'All devices are revoked when you sign out everywhere' },
            ]}
          />
          {notice(signOutNotice)}
          <p className="form-note">
            Signing out everywhere revokes every refresh token for your account, not just this
            browser. Use it if you think a session was exposed.
          </p>
          <div className="form-actions">
            <button
              className="secondary-button"
              type="button"
              disabled={signingOut}
              onClick={signOutEverywhere}
              style={signingOut ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}
            >
              <LogOut /> {signingOut ? 'Signing out…' : 'Sign out everywhere'}
            </button>
          </div>
        </Panel>
      </div>
    </div>
  )
}

