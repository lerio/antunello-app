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

// Format date with relative labels (Today, Yesterday) and day of week for older dates
export function formatDateHeader(isoString: string): string {
  const date = new Date(isoString)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  
  // Reset time to compare only dates
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())
  
  if (dateOnly.getTime() === todayOnly.getTime()) {
    return `Today, ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
  } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
    return `Yesterday, ${date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
  } else if (date.getFullYear() === today.getFullYear()) {
    // Same year: "Monday, August 2"
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    })
  } else {
    // Different year: "Tuesday, December 31, 2024"
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    })
  }
} 