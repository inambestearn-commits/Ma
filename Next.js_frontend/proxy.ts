import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAdminRoleKey } from '@/lib/admin-role'

const PARTNER_PREFIX = '/p'
const ADMIN_LOGIN = '/admin/login'
const PUBLIC_PATHS = ['/login', '/p/login', ADMIN_LOGIN]

/**
 * Root-level routes rendered by the (dashboard) route group — the admin
 * workspace. `/admin/*` is intentionally absent so the admin login page stays
 * public.
 */
const ADMIN_ROOTS = [
  '/',
  '/partners',
  '/sites',
  '/publishers',
  '/reporting',
  '/payments',
  '/mcm',
  '/alerts',
  '/notifications',
  '/audit',
  '/health',
  '/support',
  '/settings',
]

async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Do not run code between createServerClient and getUser() — it can cause
  // hard-to-debug session desync issues.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { supabaseResponse, user }
}

function hasPartnerTag(user: { app_metadata?: Record<string, unknown> } | null): boolean {
  const tag = user?.app_metadata?.partner_tag
  return typeof tag === 'string' && /^[a-z0-9][a-z0-9-]{0,31}$/.test(tag.trim().toLowerCase())
}

function hasAdminRole(user: { app_metadata?: Record<string, unknown> } | null): boolean {
  return isAdminRoleKey(user?.app_metadata?.role)
}

/** Partner portal paths. Note: `startsWith('/p')` alone would also match
 *  `/partners`, `/payments`, … which belong to the admin workspace. */
function isPartnerPath(pathname: string): boolean {
  return (
    pathname === PARTNER_PREFIX ||
    pathname.startsWith(PARTNER_PREFIX + '/') ||
    pathname.startsWith('/api/p/')
  )
}

function isAdminPath(pathname: string): boolean {
  return ADMIN_ROOTS.some((root) =>
    root === '/' ? pathname === '/' : pathname === root || pathname.startsWith(root + '/'),
  )
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const partnerPath = isPartnerPath(pathname)
  const adminPath = isAdminPath(pathname)
  const isLogin = pathname === '/login'
  const isAdminLogin = pathname === ADMIN_LOGIN

  const needsGate = partnerPath || adminPath || isLogin || isAdminLogin

  if (!needsGate) return NextResponse.next({ request })

  const { supabaseResponse, user } = await updateSession(request)

  const isPartner = hasPartnerTag(user)
  const isAdmin = hasAdminRole(user)

  const redirectTo = (target: string, next?: string) => {
    const url = request.nextUrl.clone()
    url.pathname = target
    url.search = ''
    if (next) url.searchParams.set('next', next)
    return NextResponse.redirect(url)
  }

  // Admin login page: public, but a signed-in admin/partner is bounced out.
  if (isAdminLogin) {
    if (isAdmin) return redirectTo('/')
    if (isPartner) return redirectTo('/p')
    return supabaseResponse
  }

  // Admin workspace: requires an admin role.
  if (adminPath) {
    if (!isAdmin) {
      if (isPartner) return redirectTo('/p')
      return redirectTo(ADMIN_LOGIN, pathname)
    }
    // Signed-in admin never sits on a login screen.
    if (isLogin) return redirectTo('/')
    return supabaseResponse
  }

  // Partner portal (and its BFF API routes): requires a partner tag.
  if (partnerPath) {
    if (!isPartner) {
      if (isAdmin) return redirectTo('/')
      if (pathname.startsWith('/api/p/')) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      }
      if (!PUBLIC_PATHS.includes(pathname)) return redirectTo('/login', pathname)
      return supabaseResponse
    }
    // Authenticated partner: never let them sit on the login screen.
    if (isLogin || pathname === '/p/login') return redirectTo('/p')
    return supabaseResponse
  }

  // /login (public): route each signed-in audience to its own workspace.
  if (isLogin) {
    if (isAdmin) return redirectTo('/')
    if (isPartner) return redirectTo('/p')
    return supabaseResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/p/:path*',
    '/api/p/:path*',
    '/login',
    '/admin/:path*',
    '/',
    '/partners/:path*',
    '/sites/:path*',
    '/publishers/:path*',
    '/reporting/:path*',
    '/payments/:path*',
    '/mcm/:path*',
    '/alerts/:path*',
    '/notifications/:path*',
    '/audit/:path*',
    '/health/:path*',
    '/support/:path*',
    '/settings/:path*',
  ],
}
