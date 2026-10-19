'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { Field } from '@/components/kit'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
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

      // A signed-in user without a partner tag has no inventory to show.
      // Treat that the same as a failed sign-in rather than landing them on
      // an empty workspace.
      const tag = data.user?.app_metadata?.partner_tag
      if (typeof tag !== 'string' || !tag.trim()) {
        await supabase.auth.signOut()
        setError('This account has no partner workspace provisioned. Contact your account manager.')
        return
      }

      // Only honour same-origin relative paths — an absolute URL here would
      // let a crafted link bounce the user off-site after sign-in.
      const next = searchParams.get('next')
      router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/p')
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

        <h1>Partner sign in</h1>
        <p className="sub">
          Sign in to your partner workspace to see your sites, revenue and performance.
        </p>

        <form className="auth-fields" onSubmit={submit}>
          <Field label="Email">
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
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
          Partner accounts are provisioned by an administrator. If you need access, contact your
          account manager.
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
