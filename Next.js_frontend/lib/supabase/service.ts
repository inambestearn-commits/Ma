import { createClient } from '@supabase/supabase-js'

/**
 * Supabase admin client using the service-role key.
 *
 * Only used server-side (route handlers / server actions) — the service-role
 * key MUST NEVER reach the browser. It bypasses Row Level Security and can
 * create / mutate auth users.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!url || !serviceKey) {
    throw new Error('Supabase service-role credentials are not configured.')
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
