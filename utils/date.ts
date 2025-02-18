// Format date for datetime-local input (local timezone)
export function formatDateTimeLocal(dateString: string): string {
  const date = new Date(dateString)
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

// Format date only (DD/MM/YYYY)
export function formatDate(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// Parse datetime-local input and return ISO string
export function parseDateTime(date: string): string {
  return new Date(date).toISOString()
} 