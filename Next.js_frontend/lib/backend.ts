/**
 * Django backend access layer.
 *
 * Every call carries the current Supabase access token as `Authorization:
 * Bearer <token>` so the backend can verify identity (Supabase) and resolve
 * authorization (BigQuery ma_new_data).
 *
 * Works both client-side (browser session cookie) and server-side (route
 * handlers / server components via the SSR Supabase client).
 */

export const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000').replace(
  /\/$/,
  '',
)

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Current Supabase access token, or null when signed out.
 *
 * Browser only: api.ts is consumed by client components (React Query hooks),
 * which is where the session cookie is available. On the server this returns
 * null so callers fall back to their dummy data instead of leaking a server
 * module into the client bundle.
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    if (typeof window === 'undefined') return null
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

async function readDetail(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (body && typeof body === 'object') {
      const err = (body as { error?: { message?: string }; detail?: string; message?: string }).error
      return (
        err?.message ??
        (body as { detail?: string }).detail ??
        (body as { message?: string }).message ??
        `Request failed with status ${res.status}`
      )
    }
    return `Request failed with status ${res.status}`
  } catch {
    return `Request failed with status ${res.status}`
  }
}

/** Fetch a backend path with the Supabase token attached. Throws ApiError. */
export async function backendFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  })
  if (!res.ok) throw new ApiError(res.status, await readDetail(res))
  return (await res.json()) as T
}

export function search(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '' || value === null) continue
    qs.set(key, String(value))
  }
  const encoded = qs.toString()
  return encoded ? `?${encoded}` : ''
}
