import { useEffect, useRef, useState } from 'react'
import { useSWRConfig } from 'swr'
import { createClient } from '@/utils/supabase/client'
import { cacheProvider } from '@/lib/cache-provider'

export function useAdvancedSync() {
  const { mutate } = useSWRConfig()
  const supabase = createClient()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [syncQueue, setSyncQueue] = useState<Array<{ key: string; data: any }>>([])
  const lastSyncRef = useRef<number>(Date.now())

  // Online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Background sync when coming back online
  useEffect(() => {
    if (isOnline && syncQueue.length > 0) {
      processSyncQueue()
    }
  }, [isOnline, syncQueue])

  // Periodic background sync
  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline) {
        backgroundSync()
      }
    }, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [isOnline])

  // Cross-tab synchronization
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key?.startsWith('antunello_sync_')) {
        const data = JSON.parse(event.newValue || '{}')
        handleCrossTabSync(data)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Real-time subscription with enhanced error handling
  useEffect(() => {
    let channel: any
    let reconnectAttempts = 0
    const maxReconnectAttempts = 5

    const setupSubscription = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        channel = supabase
          .channel('transactions_enhanced')
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${user.id}`
          }, (payload) => {
            handleRealtimeUpdate(payload)
          })
          .on('system', {}, (payload) => {
            if (payload.event === 'SYSTEM_ERROR') {
              handleRealtimeError()
            }
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              reconnectAttempts = 0
            }
          })
      } catch (error) {
        console.error('Realtime subscription error:', error)
        handleRealtimeError()
      }
    }

    const handleRealtimeError = () => {
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++
        setTimeout(setupSubscription, 1000 * reconnectAttempts)
      }
    }

    setupSubscription()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [])

  const handleRealtimeUpdate = (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload
    
    // Update cache immediately
    updateCacheFromRealtime(eventType, newRecord, oldRecord)
    
    // Broadcast to other tabs
    broadcastToTabs({
      type: 'realtime_update',
      payload: { eventType, newRecord, oldRecord },
      timestamp: Date.now()
    })
  }

  const updateCacheFromRealtime = (eventType: string, newRecord: any, oldRecord: any) => {
    switch (eventType) {
      case 'INSERT':
        invalidateTransactionCaches(newRecord)
        break
      case 'UPDATE':
        invalidateTransactionCaches(newRecord, oldRecord)
        break
      case 'DELETE':
        invalidateTransactionCaches(oldRecord)
        break
    }
  }

  const invalidateTransactionCaches = (record: any, oldRecord?: any) => {
    const patterns = [
      `transactions-${new Date(record.date).getFullYear()}-*`,
      `transaction-${record.id}`,
    ]
    
    if (oldRecord && oldRecord.date !== record.date) {
      patterns.push(`transactions-${new Date(oldRecord.date).getFullYear()}-*`)
    }

    patterns.forEach(pattern => {
      cacheProvider.invalidatePattern(pattern)
      // Also invalidate SWR cache
      mutate(key => typeof key === 'string' && new RegExp(pattern.replace(/\*/g, '.*')).test(key))
    })
  }

  const processSyncQueue = async () => {
    if (!isOnline) return

    const itemsToProcess = [...syncQueue]
    setSyncQueue([])

    for (const item of itemsToProcess) {
      try {
        await cacheProvider.set(item.key, item.data)
        mutate(item.key, item.data, false)
      } catch (error) {
        console.error('Sync queue processing error:', error)
        // Re-add to queue for retry
        setSyncQueue(prev => [...prev, item])
      }
    }
  }

  const backgroundSync = async () => {
    if (!isOnline) return

    const now = Date.now()
    const timeSinceLastSync = now - lastSyncRef.current

    // Only sync if it's been more than 30 seconds
    if (timeSinceLastSync < 30000) return

    try {
      // Fetch recent transactions to check for updates
      const { data: recentTransactions } = await supabase
        .from('transactions')
        .select('*')
        .gte('updated_at', new Date(lastSyncRef.current).toISOString())
        .order('updated_at', { ascending: false })

      if (recentTransactions && recentTransactions.length > 0) {
        // Group by month for cache invalidation
        const monthsToInvalidate = new Set<string>()
        
        recentTransactions.forEach(transaction => {
          const date = new Date(transaction.date)
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          monthsToInvalidate.add(monthKey)
        })

        // Invalidate affected months
        monthsToInvalidate.forEach(monthKey => {
          mutate(`transactions-${monthKey}`)
        })
      }

      lastSyncRef.current = now
    } catch (error) {
      console.error('Background sync error:', error)
    }
  }

  const handleCrossTabSync = (data: any) => {
    if (data.type === 'realtime_update') {
      const { eventType, newRecord, oldRecord } = data.payload
      updateCacheFromRealtime(eventType, newRecord, oldRecord)
    }
  }

  const broadcastToTabs = (data: any) => {
    const key = `antunello_sync_${Date.now()}`
    localStorage.setItem(key, JSON.stringify(data))
    // Clean up after a short delay
    setTimeout(() => localStorage.removeItem(key), 1000)
  }

  const queueOfflineSync = (key: string, data: any) => {
    setSyncQueue(prev => {
      const existing = prev.find(item => item.key === key)
      if (existing) {
        existing.data = data
        return [...prev]
      }
      return [...prev, { key, data }]
    })
  }

  return {
    isOnline,
    syncQueue: syncQueue.length,
    queueOfflineSync,
    invalidateTransactionCaches,
    backgroundSync
  }
}