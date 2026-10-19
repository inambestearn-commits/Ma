'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Portal } from '@/lib/data/types'

interface PortalState {
  portal: Portal
  setPortal: (p: Portal) => void
  togglePortal: () => void
}

const PortalContext = createContext<PortalState | null>(null)
const STORAGE_KEY = 'agx.portal'

export function PortalProvider({ children }: { children: React.ReactNode }) {
  const [portal, setPortalState] = useState<Portal>('admin')

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'admin' || stored === 'partner') setPortalState(stored)
  }, [])

  const setPortal = useCallback((p: Portal) => {
    setPortalState(p)
    window.localStorage.setItem(STORAGE_KEY, p)
  }, [])

  const togglePortal = useCallback(() => {
    setPortalState((prev) => {
      const next: Portal = prev === 'admin' ? 'partner' : 'admin'
      window.localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }, [])

  const value = useMemo(() => ({ portal, setPortal, togglePortal }), [portal, setPortal, togglePortal])

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
}

export function usePortal(): PortalState {
  const ctx = useContext(PortalContext)
  if (!ctx) throw new Error('usePortal must be used inside <PortalProvider>')
  return ctx
}
