'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Activity, ArrowUpRight, BarChart3, Boxes, LayoutDashboard, LifeBuoy, LogOut, Menu,
  Settings, Users, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface NavEntry {
  label: string
  href: string
  icon: typeof Boxes
}

const NAV: NavEntry[] = [
  { label: 'Home', href: '/p', icon: LayoutDashboard },
  { label: 'Publishers', href: '/p/publishers', icon: Users },
  { label: 'My Sites', href: '/p/sites', icon: Boxes },
  { label: 'Reporting', href: '/p/reporting', icon: Activity },
  // Hidden for now — `mcm_earnings` is empty, so the page renders nothing worth
  // showing. The route still works; restore this line to bring the link back.
  // { label: 'Payments', href: '/p/payments', icon: Banknote },
  { label: 'Support', href: '/p/tickets', icon: LifeBuoy },
  { label: 'Settings', href: '/p/settings', icon: Settings },
]

const TITLES: Record<string, string> = {
  '/p': 'Home',
  '/p/publishers': 'Publishers',
  '/p/publishers/new': 'Add publisher',
  '/p/publishers/requests': 'My requests',
  '/p/sites': 'My Sites',
  '/p/reporting': 'Reporting',
  '/p/payments': 'Payments',
  '/p/tickets': 'Support tickets',
  '/p/tickets/new': 'New ticket',
  '/p/settings': 'Settings',
}

const logoUrl =
  'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/WhatsApp%20Image%202026-09-25%20at%207.15.10%20PM-5OpCcGwUlBgSa30ECY8DJYPIBQrcza.jpeg'

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname]
  const parent = '/' + pathname.split('/').filter(Boolean).slice(0, 2).join('/')
  return TITLES[parent] ?? 'Workspace'
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/p') return pathname === '/p'
  return pathname === href || pathname.startsWith(href + '/')
}

export function PartnerShell({
  children,
  partner,
}: {
  children: React.ReactNode
  partner: { tag: string; email: string; fullName: string | null }
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)
  // The topbar changes shape once the page has scrolled: it detaches from the
  // viewport edges and goes translucent. Driven by a scroll listener rather
  // than CSS alone, because the state is not expressible in a selector.
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => setMobileOpen(false), [pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const displayName = partner.fullName || partner.email.split('@')[0] || partner.tag
  const initials = displayName
    .split(/[\s.-]+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  async function signOut() {
    await createClient().auth.signOut()
    router.replace('/login')
  }

  return (
    <main className="app-shell">
      <aside className={mobileOpen ? 'sidebar mobile-open' : 'sidebar'}>
        <div className="sidebar-brand">
          <img src={logoUrl} alt="AdGlobeX Media" className="brand-logo" />
          <button className="close-mobile" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X />
          </button>
        </div>

        <div className="workspace-switcher">
          <div className="workspace-mark">{partner.tag.slice(-2).toUpperCase()}</div>
          <div>
            <p className="workspace-name">{displayName}</p>
            <p className="workspace-plan">{partner.tag.toUpperCase()} · Partner portal</p>
          </div>
        </div>

        <nav className="main-nav" aria-label="Partner navigation">
          {NAV.map((entry) => {
            const Icon = entry.icon
            return (
              <div key={entry.href} className="nav-entry">
                <Link
                  href={entry.href}
                  data-label={entry.label}
                  className={isActive(pathname, entry.href) ? 'nav-item active' : 'nav-item'}
                >
                  <Icon />
                  <span>{entry.label}</span>
                </Link>
              </div>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <Link href="/p/tickets" className="support-card">
            <div className="support-icon"><LifeBuoy /></div>
            <div>
              <strong>Need a hand?</strong>
              <span>File a support ticket</span>
            </div>
            <ArrowUpRight />
          </Link>
          <div className="profile-row">
            <div className="profile-avatar">{initials}</div>
            <div className="profile-info">
              <strong>{displayName}</strong>
              <span>{partner.tag.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </aside>

      {mobileOpen ? (
        <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
      ) : null}

      <section className="main-content">
        <header className={scrolled ? 'topbar is-scrolled' : 'topbar'}>
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu />
            </button>
            <div className="breadcrumbs">
              <span>Partner portal</span>
              <span>/</span>
              <strong>{titleFor(pathname)}</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <span className="chip chip-info"><BarChart3 /> {partner.tag.toUpperCase()}</span>

            <div className="topbar-profile">
              <span className="mini-avatar">{initials}</span>
              <span className="topbar-profile-text">
                <strong>{displayName}</strong>
                <small>{partner.tag.toUpperCase()} · Partner</small>
              </span>
            </div>

            <button
              className="topbar-icon"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => setSignOutOpen(true)}
            >
              <LogOut />
            </button>
          </div>
        </header>

        <div className="content-wrap">{children}</div>
      </section>

      {signOutOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setSignOutOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSignOutOpen(false)} aria-label="Close"><X /></button>
            <p className="panel-kicker">SESSION</p>
            <h2>Sign out?</h2>
            <p className="modal-copy">
              You are signed in to the {partner.tag.toUpperCase()} workspace. Signing out ends this session
              on this device.
            </p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setSignOutOpen(false)}>Cancel</button>
              <button className="primary-button" onClick={signOut}>Sign out</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
