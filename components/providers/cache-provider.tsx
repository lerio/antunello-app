'use client'

import { SWRConfig } from 'swr'
import { swrConfig } from '@/lib/swr-config'
import { useAdvancedSync } from '@/hooks/useAdvancedSync'

export function CacheProvider({ children }: { children: React.ReactNode }) {
  // Initialize advanced sync system
  useAdvancedSync()

  return (
    <SWRConfig value={swrConfig}>
      {children}
    </SWRConfig>
  )
}