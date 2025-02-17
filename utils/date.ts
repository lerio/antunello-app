// Format date for datetime-local input (local timezone)
export function formatDateTimeLocal(isoString: string): string {
  const date = new Date(isoString)
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

// Format date for display in the table (local timezone)
export function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

// Parse datetime-local input and return ISO string
export function parseDateTime(localDateTime: string): string {
  return new Date(localDateTime).toISOString()
} 