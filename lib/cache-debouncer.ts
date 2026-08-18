/**
 * @file Provides debounced and periodic cache-saving utilities to reduce
 * the frequency of expensive operations such as localStorage writes.
 * Includes a debounced save with a configurable delay, a periodic
 * save interval (skipped while the tab is hidden), plus a pagehide
 * handler to flush when the page is navigated away from. `pagehide`
 * (unlike `beforeunload`) keeps the page eligible for back/forward
 * cache, enabling instant tab-switch resume on iOS Safari.
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
 * Registers a repeating interval (skipped while the tab is hidden) and a
 * `pagehide` event listener that flushes the cache when the page is
 * navigated away from.
 *
 * @param saveFunction - The function to call on each periodic save.
 * @returns A cleanup function that clears the interval, removes the
 *          `pagehide` listener, and cancels any pending debounced save.
 */
export function setupPeriodicSave(saveFunction: () => void) {
  // Ensure we're in a browser-like environment
  if (typeof globalThis.addEventListener !== 'function') return null

  const interval = setInterval(() => {
    // Skip saves while the tab is hidden: the work is wasted in the
    // background and bursts on resume (iOS Safari freezes/thaws tabs)
    if (typeof document !== 'undefined' && document.hidden) return
    saveFunction()
  }, PERIODIC_SAVE_MS)

  // Save when the page is hidden or navigated away from.
  // `pagehide` (unlike `beforeunload`) doesn't disqualify the page from
  // back/forward cache, so tab-switch resume can stay instant.
  const handlePageHide: EventListener = () => {
    saveFunction()
  }

  globalThis.addEventListener('pagehide', handlePageHide)

  // Return cleanup function
  return () => {
    clearInterval(interval)
    globalThis.removeEventListener('pagehide', handlePageHide)
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      saveTimeout = null
    }
  }
}
