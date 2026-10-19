'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { Field } from '@/components/kit'
import { isAdminRoleKey } from '@/lib/admin-role'
import { createClient } from '@/lib/supabase/client'

function AdminLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)

    try {
      const supabase = createClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        setError(
          signInError.message === 'Invalid login credentials'
            ? 'Email or password is incorrect.'
            : signInError.message,
        )
        return
      }

      // Admin sign-in requires a GLOBAL admin role in app_metadata. Partner
      // accounts are rejected here and sent to their own portal instead of
      // silently landing in the admin workspace.
      const role = data.user?.app_metadata?.role
      if (!isAdminRoleKey(role)) {
        const isPartner = typeof data.user?.app_metadata?.partner_tag === 'string'
        await supabase.auth.signOut()
        setError(
          isPartner
            ? 'This is a partner account. Use the partner sign-in page instead.'
            : 'This account does not have admin access. Contact your administrator.',
        )
        return
      }

      // Only honour same-origin relative paths — an absolute URL here would
      // let a crafted link bounce the user off-site after sign-in.
      const next = searchParams.get('next')
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/')
      router.refresh()
    } catch {
      setError('Sign-in failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <strong>AdGlobeX</strong>
          <span>MEDIA</span>
        </div>

        <h1>Admin sign in</h1>
        <p className="sub">
          Sign in to the AdGlobeX admin workspace to manage partners, publishers and reporting.
        </p>

        <form className="auth-fields" onSubmit={submit}>
          <Field label="Email">
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@adglobex.com"
              autoComplete="email"
              required
            />
          </Field>

          <Field label="Password">
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </Field>

          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="form-actions">
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : 'Sign in'}
            </button>
          </div>
        </form>

        <p className="auth-hint">
          Admin accounts are provisioned by an administrator. Partner accounts should use the
          partner sign-in page.
        </p>
      </div>
    </main>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginForm />
    </Suspense>
  )
}
