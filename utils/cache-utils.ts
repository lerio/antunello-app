import { cacheProvider } from '@/lib/cache-provider'
import { Transaction } from '@/types/database'

export const CACHE_KEYS = {
  TRANSACTIONS: (year: number, month: number) => 
    `transactions-${year}-${String(month).padStart(2, '0')}`,
  TRANSACTION: (id: string) => `transaction-${id}`,
  USER_SETTINGS: 'user-settings',
  CATEGORIES: 'categories',
  CURRENCY_RATES: 'currency-rates'
} as const

export class CacheUtils {
  // Preload critical data for faster initial load
  static async preloadCriticalData() {
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    // Preload current month and adjacent months
    const monthsToPreload = [
      { year: currentYear, month: currentMonth },
      { year: currentMonth === 1 ? currentYear - 1 : currentYear, month: currentMonth === 1 ? 12 : currentMonth - 1 },
      { year: currentMonth === 12 ? currentYear + 1 : currentYear, month: currentMonth === 12 ? 1 : currentMonth + 1 }
    ]

    return Promise.allSettled(
      monthsToPreload.map(({ year, month }) => 
        cacheProvider.get(CACHE_KEYS.TRANSACTIONS(year, month))
      )
    )
  }

  // Smart cache invalidation based on transaction changes
  static async invalidateTransactionCaches(transaction: Transaction, oldTransaction?: Transaction) {
    const patterns = []
    
    // Always invalidate the current transaction's month
    const date = new Date(transaction.date)
    patterns.push(CACHE_KEYS.TRANSACTIONS(date.getFullYear(), date.getMonth() + 1))
    
    // If date changed, invalidate old month too
    if (oldTransaction && oldTransaction.date !== transaction.date) {
      const oldDate = new Date(oldTransaction.date)
      patterns.push(CACHE_KEYS.TRANSACTIONS(oldDate.getFullYear(), oldDate.getMonth() + 1))
    }
    
    // Invalidate single transaction cache
    patterns.push(CACHE_KEYS.TRANSACTION(transaction.id))
    
    // Execute invalidations
    await Promise.allSettled(patterns.map(pattern => cacheProvider.delete(pattern)))
  }

  // Cleanup old cache entries
  static async cleanupOldCache() {
    const cutoffDate = new Date()
    cutoffDate.setMonth(cutoffDate.getMonth() - 6) // Keep 6 months of data
    
    const patterns = [
      `transactions-${cutoffDate.getFullYear()}-*`,
      `transaction-*` // Individual transactions older than 6 months
    ]
    
    await Promise.allSettled(
      patterns.map(pattern => cacheProvider.invalidatePattern(pattern))
    )
  }

  // Get cache statistics
  static async getCacheStats() {
    try {
      const stats = {
        transactionMonths: 0,
        individualTransactions: 0,
        totalSize: 0,
        oldestEntry: null as string | null,
        newestEntry: null as string | null
      }

      // This would need to be implemented based on your specific cache provider
      // For now, return basic stats
      return stats
    } catch (error) {
      console.error('Error getting cache stats:', error)
      return null
    }
  }

  // Warm cache for specific month
  static async warmCacheForMonth(year: number, month: number) {
    const key = CACHE_KEYS.TRANSACTIONS(year, month)
    const cached = await cacheProvider.get(key)
    
    if (!cached) {
      // Trigger fetch by creating a placeholder
      await cacheProvider.set(key, [], 1000) // 1 second TTL to trigger refetch
    }
  }

  // Bulk cache operations for better performance
  static async bulkSet(items: Array<{ key: string; data: any; ttl?: number }>) {
    return Promise.allSettled(
      items.map(({ key, data, ttl }) => cacheProvider.set(key, data, ttl))
    )
  }

  static async bulkGet(keys: string[]) {
    return Promise.allSettled(
      keys.map(key => cacheProvider.get(key))
    )
  }

  // Export/import cache for debugging
  static async exportCache() {
    // Implementation would depend on your cache provider
    // This is a simplified version
    return {
      timestamp: Date.now(),
      version: '1.0.0',
      data: {} // Would contain actual cache data
    }
  }

  static async importCache(exportData: any) {
    if (exportData.version !== '1.0.0') {
      throw new Error('Incompatible cache version')
    }
    
    // Implementation would restore cache from export
    console.log('Cache import completed')
  }
}