/**
 * @file Provides debounced and periodic cache-saving utilities to reduce
 * the frequency of expensive operations such as localStorage writes.
 * Includes a debounced save with a configurable delay and a periodic
 * save interval, plus a beforeunload handler to flush on page close.
 */

let saveTimeout: NodeJS.Timeout | null = null
const SAVE_DEBOUNCE_MS = 2000 // Wait 2 seconds before saving
const PERIODIC_SAVE_MS = 30000 // Save every 30 seconds regardless

/**
 * Debounced cache save function to avoid excessive localStorage writes.
 * Resets the internal timer on each call so that the `saveFunction` is
 * only invoked after `SAVE_DEBOUNCE_MS` milliseconds of inactivity.
 *
 * @param saveFunction - The function to call once the debounce period elapses.
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
 * Setup periodic cache saves to ensure data persistence.
 * Registers a repeating interval and a `beforeunload` event listener that
 * flushes the cache when the page is closed or navigated away from.
 *
 * @param saveFunction - The function to call on each periodic save.
 * @returns A cleanup function that clears the interval, removes the
 *          `beforeunload` listener, and cancels any pending debounced save.
 */
export function setupPeriodicSave(saveFunction: () => void) {
  // Ensure we're in a browser-like environment
  if (typeof globalThis.addEventListener !== 'function') return null

  const interval = setInterval(() => {
    saveFunction()
  }, PERIODIC_SAVE_MS)

  // Save on page unload as well
  const handleBeforeUnload: EventListener = () => {
    saveFunction()
  }

  globalThis.addEventListener('beforeunload', handleBeforeUnload)

  // Return cleanup function
  return () => {
    clearInterval(interval)
    globalThis.removeEventListener('beforeunload', handleBeforeUnload)
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      saveTimeout = null
    }
  }
}
