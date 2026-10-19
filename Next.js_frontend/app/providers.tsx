'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { PortalProvider } from '@/lib/portal'

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  )

  return (
    <QueryClientProvider client={client}>
      <PortalProvider>{children}</PortalProvider>
    </QueryClientProvider>
  )
}
