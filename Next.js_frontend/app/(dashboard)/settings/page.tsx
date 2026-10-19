'use client'

import { useEffect, useState } from 'react'
import { Field, KeyValue, PageHeader, Panel, Select } from '@/components/kit'
import { usePortal } from '@/lib/portal'

const timezoneOptions = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America / New York' },
  { value: 'Europe/London', label: 'Europe / London' },
  { value: 'America/Los_Angeles', label: 'America / Los Angeles' },
]

const currencyOptions = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
]

const twoFactorOptions = [
  { value: 'required', label: 'Required for admins' },
  { value: 'optional', label: 'Optional' },
  { value: 'disabled', label: 'Disabled' },
]

const sessionOptions = [
  { value: '15m', label: '15 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '8h', label: '8 hours' },
]

const passwordOptions = [
  { value: 'strict', label: 'Strict — 16 characters with symbols' },
  { value: 'standard', label: 'Standard — 12 characters, mixed case' },
  { value: 'custom', label: 'Custom — per-role override' },
]

const onOffOptions = [
  { value: 'enabled', label: 'Enabled' },
  { value: 'disabled', label: 'Disabled' },
]

const partnerPrefs = [
  { key: 'payment', label: 'Payment released' },
  { key: 'policy', label: 'Policy issue opened' },
  { key: 'smartAlert', label: 'Smart alert triggered' },
  { key: 'invite', label: 'Invite accepted / declined / expired' },
  { key: 'withdrawn', label: 'Publisher withdrawn' },
  { key: 'mcm', label: 'MCM / API error' },
  { key: 'digest', label: 'Weekly digest' },
]

const adminExtraPref = { key: 'globalRules', label: 'Global rule changes' }

const defaultPrefs: Record<string, boolean> = {
  payment: true,
  policy: true,
  smartAlert: true,
  invite: true,
  withdrawn: false,
  mcm: true,
  digest: false,
  globalRules: true,
}

function prefsFor(isAdmin: boolean) {
  const seeded: Record<string, boolean> = {}
  for (const key of Object.keys(defaultPrefs)) {
    if (key === 'globalRules' && !isAdmin) continue
    seeded[key] = defaultPrefs[key]
  }
  return seeded
}

export default function SettingsPage() {
  const { portal } = usePortal()
  const isAdmin = portal === 'admin'

  const [company, setCompany] = useState('AdGlobeX Media')
  const [contactEmail, setContactEmail] = useState('alex@adglobex.media')
  const [primaryContact, setPrimaryContact] = useState('Alex Moreno')
  const [timezone, setTimezone] = useState('UTC')
  const [currency, setCurrency] = useState('USD')
  const [twoFactor, setTwoFactor] = useState('required')
  const [session, setSession] = useState('1h')
  const [passwordPolicy, setPasswordPolicy] = useState('strict')
  const [prefs, setPrefs] = useState<Record<string, boolean>>(defaultPrefs)
  const [multiMcm, setMultiMcm] = useState('disabled')
  const [onboardingEmbed, setOnboardingEmbed] = useState('disabled')
  const [autoWithdraw, setAutoWithdraw] = useState('enabled')
  const [csvReconcile, setCsvReconcile] = useState('enabled')

  useEffect(() => {
    setCompany(isAdmin ? 'AdGlobeX Media' : 'Northstar Publishing')
    setContactEmail(isAdmin ? 'alex@adglobex.media' : 'ops@northstarpublishing.com')
    setPrimaryContact(isAdmin ? 'Alex Moreno' : 'Dana Reyes')
    setTwoFactor(isAdmin ? 'required' : 'optional')
    setPrefs((prev) => {
      const seeded = prefsFor(isAdmin)
      for (const key of Object.keys(seeded)) if (key in prev) seeded[key] = prev[key]
      return seeded
    })
  }, [isAdmin])

  const prefsList = isAdmin ? [...partnerPrefs, adminExtraPref] : partnerPrefs

  function togglePref(key: string, checked: boolean) {
    setPrefs((prev) => ({ ...prev, [key]: checked }))
  }

  function discard() {
    setCompany(isAdmin ? 'AdGlobeX Media' : 'Northstar Publishing')
    setContactEmail(isAdmin ? 'alex@adglobex.media' : 'ops@northstarpublishing.com')
    setPrimaryContact(isAdmin ? 'Alex Moreno' : 'Dana Reyes')
    setTimezone('UTC')
    setCurrency('USD')
    setTwoFactor(isAdmin ? 'required' : 'optional')
    setSession('1h')
    setPasswordPolicy('strict')
    setPrefs(prefsFor(isAdmin))
    setMultiMcm('disabled')
    setOnboardingEmbed('disabled')
    setAutoWithdraw('enabled')
    setCsvReconcile('enabled')
  }

  const actions = (
    <div className="form-actions">
      <button className="secondary-button" type="button" onClick={discard}>Discard</button>
      <button className="primary-button" type="button">Save changes</button>
    </div>
  )

  return (
    <>
      <PageHeader
        eyebrow={isAdmin ? 'PLATFORM' : 'WORKSPACE'}
        title="Settings"
        subtitle={
          isAdmin
            ? 'Platform-wide configuration, security, notifications, defaults, integrations and feature flags.'
            : 'Company details, profile, security and notification preferences for AGX-1001.'
        }
      />

      <div className="detail-grid">
        <Panel kicker="PROFILE" title="Company details">
          <div className="form-grid">
            <Field label="Company name">
              <input
                className="input"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                autoComplete="organization"
              />
            </Field>
            <Field label="Contact email">
              <input
                className="input"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                autoComplete="email"
              />
            </Field>
            <Field label="Primary contact">
              <input
                className="input"
                value={primaryContact}
                onChange={(e) => setPrimaryContact(e.target.value)}
                autoComplete="name"
              />
            </Field>
            <Field label="Timezone">
              <Select value={timezone} onChange={setTimezone} options={timezoneOptions} />
            </Field>
            <Field label="Currency">
              <Select value={currency} onChange={setCurrency} options={currencyOptions} />
            </Field>
          </div>
          {actions}
        </Panel>

        <Panel kicker="SECURITY" title="Access and sessions">
          <div className="form-grid">
            <Field label="Two-factor authentication">
              <Select value={twoFactor} onChange={setTwoFactor} options={twoFactorOptions} />
            </Field>
            <Field label="Session timeout">
              <Select value={session} onChange={setSession} options={sessionOptions} />
            </Field>
            <Field label="Password policy">
              <Select value={passwordPolicy} onChange={setPasswordPolicy} options={passwordOptions} />
            </Field>
          </div>
          <p className="form-note">
            Privileged admin accounts should support 2FA/MFA. Credentials are owned by Supabase
            Auth — password change is proxied by the backend and never handled in the browser.
          </p>
          {actions}
        </Panel>
      </div>

      <div style={{ marginTop: 16 }}>
        <Panel kicker="NOTIFICATIONS" title="Notification preferences">
          <div className="form-grid">
            {prefsList.map((pref) => (
              <label
                className="field-label"
                key={pref.key}
                style={{ display: 'flex', alignItems: 'center', gap: 9 }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(prefs[pref.key])}
                  onChange={(e) => togglePref(pref.key, e.target.checked)}
                />
                {pref.label}
              </label>
            ))}
          </div>
          {actions}
        </Panel>
      </div>

      {isAdmin ? (
        <div className="detail-grid">
          <Panel kicker="INTEGRATIONS" title="Connected systems">
            <KeyValue
              items={[
                { label: 'Authentication', value: 'Supabase Auth (verified server-side)' },
                { label: 'Primary MCM', value: 'GAM Primary (MCM-001)' },
                { label: 'Analytics store', value: 'BigQuery' },
                { label: 'WAF', value: 'Cloudflare' },
              ]}
            />
            <p className="form-note">
              No MCM credentials or API secrets are ever exposed to the browser — every adapter call
              is signed server-side (§23, §21.2).
            </p>
            {actions}
          </Panel>

          <Panel kicker="FEATURE FLAGS" title="Rollout controls">
            <div className="form-grid">
              <Field label="Multi-MCM selector">
                <Select
                  value={multiMcm}
                  onChange={setMultiMcm}
                  options={[
                    { value: 'disabled', label: 'Disabled — Phase 1' },
                    { value: 'enabled', label: 'Enabled' },
                  ]}
                />
              </Field>
              <Field label="Partner onboarding embed">
                <Select
                  value={onboardingEmbed}
                  onChange={setOnboardingEmbed}
                  options={[
                    { value: 'disabled', label: 'Disabled' },
                    { value: 'enabled', label: 'Enabled' },
                  ]}
                />
              </Field>
              <Field label="Auto-withdraw">
                <Select
                  value={autoWithdraw}
                  onChange={setAutoWithdraw}
                  options={[
                    { value: 'enabled', label: 'Enabled — requires explicit rule opt-in' },
                    { value: 'disabled', label: 'Disabled' },
                  ]}
                />
              </Field>
              <Field label="CSV auto-reconcile">
                <Select value={csvReconcile} onChange={setCsvReconcile} options={onOffOptions} />
              </Field>
            </div>
            {actions}
          </Panel>
        </div>
      ) : null}
    </>
  )
}
