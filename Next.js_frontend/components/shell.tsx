'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Activity, ArrowUpRight, Bell, Boxes, BriefcaseBusiness, CreditCard,
  FileClock, HeartPulse, LayoutDashboard, LifeBuoy, LogOut, Menu, MoreHorizontal, Network,
  Plus, Search, Settings, ShieldCheck, Ticket, X,
} from 'lucide-react'
import { usePortal } from '@/lib/portal'
import type { DisplayProfile } from '@/lib/api'
import { createClient } from '@/lib/supabase/client'

type Icon = typeof Boxes

interface NavEntry {
  label: string
  href: string
  icon: Icon
  group: 'workspace' | 'manage'
  badge?: number
}

const ADMIN_NAV: NavEntry[] = [
  { label: 'Home', href: '/', icon: LayoutDashboard, group: 'workspace' },
  { label: 'Partners', href: '/partners', icon: BriefcaseBusiness, group: 'workspace' },
  { label: 'Overall Sites', href: '/sites', icon: Boxes, group: 'workspace' },
  { label: 'Reporting', href: '/reporting', icon: Activity, group: 'workspace' },
  { label: 'Payments', href: '/payments', icon: CreditCard, group: 'workspace' },
  { label: 'MCM', href: '/mcm', icon: Network, group: 'workspace' },
  { label: 'Smart Notification', href: '/alerts', icon: ShieldCheck, group: 'manage' },
  { label: 'Notifications', href: '/notifications', icon: Bell, group: 'manage' },
  { label: 'Audit Log', href: '/audit', icon: FileClock, group: 'manage' },
  { label: 'System Health', href: '/health', icon: HeartPulse, group: 'manage' },
  { label: 'Support', href: '/support', icon: Ticket, group: 'manage' },
  { label: 'Settings', href: '/settings', icon: Settings, group: 'manage' },
]

const TITLES: Record<string, string> = {
  '/': 'Home',
  '/partners': 'Partners',
  '/partners/new': 'Create Partner',
  '/sites': 'Overall Sites',
  '/publishers': 'Manage Publishers',
  '/publishers/new': 'Add Publisher',
  '/reporting': 'Reporting',
  '/payments': 'Payments',
  '/mcm': 'MCM',
  '/alerts': 'Smart Notification',
  '/notifications': 'Notifications',
  '/audit': 'Audit Log',
  '/health': 'System Health',
  '/support': 'Support',
  '/settings': 'Settings',
}

const logoUrl =
  'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/WhatsApp%20Image%202026-09-25%20at%207.15.10%20PM-5OpCcGwUlBgSa30ECY8DJYPIBQrcza.jpeg'

function titleFor(pathname: string): string {
  if (TITLES[pathname]) return TITLES[pathname]
  const parent = '/' + pathname.split('/').filter(Boolean)[0]
  if (TITLES[parent]) return TITLES[parent]
  return 'Workspace'
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/' || pathname === '/admin/login'
  return pathname === href || pathname.startsWith(href + '/')
}

interface AppShellProps {
  children: React.ReactNode
  /** Signed-in admin identity, resolved server-side so first paint is real. */
  profile: DisplayProfile
}

export function AppShell({ children, profile }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { setPortal } = usePortal()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)

  useEffect(() => setMobileOpen(false), [pathname])

  // This workspace is admin-only; pin the portal so a stale localStorage
  // value left by the old demo switcher can't flip these pages to partner data.
  useEffect(() => {
    setPortal('admin')
  }, [setPortal])

  const nav = ADMIN_NAV
  const crumb = titleFor(pathname)

  return (
    <main className="app-shell">
      <aside className={mobileOpen ? 'sidebar mobile-open' : 'sidebar'}>
        <div className="sidebar-brand">
          <img src={logoUrl} alt="AdGlobeX Media" className="brand-logo" />
          <button className="close-mobile" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X /></button>
        </div>

        <div className="workspace-switcher">
          <div className="workspace-mark">A</div>
          <div>
            <p className="workspace-name">AdGlobeX Media</p>
            <p className="workspace-plan">Super Admin portal</p>
          </div>
        </div>

        <nav className="main-nav" aria-label="Super Admin navigation">
          {nav.map((entry, i) => {
            const previous = nav[i - 1]
            const showDivider = previous && previous.group !== entry.group
            const Icon = entry.icon
            return (
              <div key={entry.href + entry.label} className="nav-entry">
                {showDivider ? <span className="nav-divider" aria-hidden="true" /> : null}
                <Link
                  href={entry.href}
                  data-label={entry.label}
                  className={isActive(pathname, entry.href) ? 'nav-item active' : 'nav-item'}
                >
                  <Icon />
                  <span>{entry.label}</span>
                  {entry.badge ? <span className="nav-badge">{entry.badge}</span> : null}
                </Link>
              </div>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <Link href="/support" className="support-card">
            <div className="support-icon"><LifeBuoy /></div>
            <div><strong>Need a hand?</strong><span>Visit help center</span></div>
            <ArrowUpRight />
          </Link>
          <div className="profile-row">
            <div className="profile-avatar">{profile.initials}</div>
            <div className="profile-info">
              <strong>{profile.full_name}</strong>
              <span>{profile.role}</span>
            </div>
            <MoreHorizontal />
          </div>
        </div>
      </aside>

      {mobileOpen ? (
        <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />
      ) : null}

      <section className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu /></button>
            <div className="breadcrumbs">
              <span>Super Admin</span>
              <span>/</span>
              <strong>{crumb}</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <Link href="/reporting" className="topbar-icon" aria-label="Search reports"><Search /></Link>
            <Link href="/notifications" className="topbar-icon notification-dot" aria-label="Notifications"><Bell /></Link>

            <div className="topbar-profile">
              <span className="mini-avatar">{profile.initials}</span>
              <span className="topbar-profile-text">
                <strong>{profile.full_name}</strong>
                <small>{profile.partner_ticket ? `${profile.role} · ${profile.partner_ticket}` : profile.role}</small>
              </span>
            </div>

            <button className="topbar-icon" aria-label="Sign out" title="Sign out" onClick={() => setSignOutOpen(true)}>
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
              You are signed in as {profile.email}. Signing out clears the local session token;
              the backend revokes it on POST /api/v1/auth/logout/.
            </p>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setSignOutOpen(false)}>Cancel</button>
              <button
                className="primary-button"
                onClick={async () => {
                  setSignOutOpen(false)
                  try {
                    await createClient().auth.signOut()
                  } catch {
                    // ignore — local session is cleared on redirect anyway
                  }
                  router.push('/admin/login')
                  router.refresh()
                }}
              >Sign out</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
