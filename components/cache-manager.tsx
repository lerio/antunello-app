'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { clearCacheStorage } from '@/lib/cache-persistence'

export function CacheManager() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        // Clear cache when user signs out or session expires
        clearCacheStorage()
        console.log('Cache cleared due to authentication change')
      }
    })

    // Cleanup listener on unmount
    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  // This component doesn't render anything
  return null
}