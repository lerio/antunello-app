let saveTimeout: NodeJS.Timeout | null = null
const SAVE_DEBOUNCE_MS = 2000 // Wait 2 seconds before saving
const PERIODIC_SAVE_MS = 30000 // Save every 30 seconds regardless

/**
 * Debounced cache save function to avoid excessive localStorage writes
 */
export function debouncedSave(saveFunction: () => void) {
  // Clear existing timeout
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }

  // Set new timeout
  saveTimeout = setTimeout(() => {
    saveFunction()
    saveTimeout = null
  }, SAVE_DEBOUNCE_MS)
}

/**
 * Setup periodic cache saves to ensure data persistence
 */
export function setupPeriodicSave(saveFunction: () => void) {
  if (typeof window === 'undefined') return null

  const interval = setInterval(() => {
    saveFunction()
  }, PERIODIC_SAVE_MS)

  // Save on page unload as well
  const handleBeforeUnload = () => {
    saveFunction()
  }

  window.addEventListener('beforeunload', handleBeforeUnload)

  // Return cleanup function
  return () => {
    clearInterval(interval)
    window.removeEventListener('beforeunload', handleBeforeUnload)
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      saveTimeout = null
    }
  }
}