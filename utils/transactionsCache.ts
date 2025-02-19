import { Transaction } from '@/types/database'

const CACHE_PREFIX = 'transactions_'

type MonthKey = string // Format: 'YYYY-MM'

export function getMonthKey(date: string): MonthKey {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function getCachedTransactions(monthKey: MonthKey): Transaction[] | null {
  try {
    const cached = localStorage.getItem(CACHE_PREFIX + monthKey)
    return cached ? JSON.parse(cached) : null
  } catch (error) {
    console.error('Error reading from cache:', error)
    return null
  }
}

export function setCachedTransactions(monthKey: MonthKey, transactions: Transaction[]): void {
  try {
    localStorage.setItem(CACHE_PREFIX + monthKey, JSON.stringify(transactions))
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      // Remove oldest month and try again
      const keys = getAllCacheKeys()
      if (keys.length > 0) {
        localStorage.removeItem(keys[0])
        try {
          localStorage.setItem(CACHE_PREFIX + monthKey, JSON.stringify(transactions))
          return
        } catch (retryError) {
          console.error('Error setting cache after cleanup:', retryError)
        }
      }
    }
    console.error('Error setting cache:', error)
  }
}

export function updateCachedTransaction(transaction: Transaction): void {
  // First find the original transaction in cache to get its old date
  const allMonths = Object.keys(localStorage)
    .filter(key => key.startsWith(CACHE_PREFIX))
    .map(key => getCachedTransactions(key.replace(CACHE_PREFIX, '')))
    .filter((cached): cached is Transaction[] => cached !== null)
    .flat()
  
  const oldTransaction = allMonths.find(t => t.id === transaction.id)

  if (oldTransaction) {
    // If date changed, remove from old month's cache
    const oldMonthKey = getMonthKey(oldTransaction.date)
    const newMonthKey = getMonthKey(transaction.date)

    if (oldMonthKey !== newMonthKey) {
      const oldMonthCache = getCachedTransactions(oldMonthKey)
      if (oldMonthCache) {
        // Remove from old month
        setCachedTransactions(
          oldMonthKey,
          oldMonthCache.filter(t => t.id !== transaction.id)
        )
      }
    }
  }

  const monthKey = getMonthKey(transaction.date)
  const cached = getCachedTransactions(monthKey)
  
  if (cached) {
    // If transaction exists in this month, update it; otherwise add it
    const exists = cached.some(t => t.id === transaction.id)
    const updated = exists
      ? cached.map(t => t.id === transaction.id ? transaction : t)
      : [...cached, transaction]

    setCachedTransactions(monthKey, updated)
  }
}

export function addToCachedTransactions(transaction: Transaction): void {
  const monthKey = getMonthKey(transaction.date)
  const cached = getCachedTransactions(monthKey)
  
  if (cached) {
    setCachedTransactions(monthKey, [...cached, transaction])
  }
}

export function deleteFromCachedTransactions(transaction: Transaction): void {
  const monthKey = getMonthKey(transaction.date)
  const cached = getCachedTransactions(monthKey)
  
  if (cached) {
    const filtered = cached.filter(t => t.id !== transaction.id)
    setCachedTransactions(monthKey, filtered)
  }
}

function getAllCacheKeys(): string[] {
  return Object.keys(localStorage)
    .filter(key => key.startsWith(CACHE_PREFIX))
    .sort()
} 