// Format date for datetime-local input (local timezone)
export function formatDateTimeLocal(date: string): string {
  return new Date(date).toISOString().slice(0, 16)
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

// Format full date and time (DD/MM/YYYY, HH:mm)
export function formatDateTimeTooltip(isoString: string): string {
  const date = new Date(isoString)
  return date.toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// Parse datetime-local input and return ISO string
export function parseDateTime(date: string): string {
  return new Date(date).toISOString()
} 