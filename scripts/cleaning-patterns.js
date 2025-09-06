/**
 * Regex patterns and cleaning rules for transaction title processing
 * Extracted to reduce webpack cache serialization size
 */

const CLEANING_PATTERNS = [
  // Remove location patterns like "//BERLIN/DE" or "//Berlin Wedding/DE"
  { pattern: /\/\/[^\/]+\/[A-Z]{2}(?:\/\d+)?\s*\/.*$/i, replacement: '' },
  { pattern: /\/\/[^\/]+\/[A-Z]{2}$/i, replacement: '' },
  
  // Remove common purchase/transaction phrases
  { pattern: /\s+Your\s+purchase\s+at\s+(.+)$/i, replacement: '' },
  { pattern: /\s+purchase\s+at\s+.+$/i, replacement: '' },
  
  // Remove common German phrases and store codes
  { pattern: /\s+SAGT\s+DANKE?\.?\s*\d*$/i, replacement: '' },
  { pattern: /\s+BEDANKT\s+SICH$/i, replacement: '' },
  { pattern: /\s+SAGT\s+DANK$/i, replacement: '' },
  
  // Remove store/branch codes and patterns
  { pattern: /\s+H:\d+/g, replacement: '' },
  { pattern: /\s+FIL\.\d+/g, replacement: '' },
  { pattern: /\s+R\d{3,}/g, replacement: '' },
  { pattern: /\s+GIR\s+\d+/g, replacement: '' },
  { pattern: /\s+\d{8,}/g, replacement: '' },
  
  // Remove alphanumeric transaction/reference codes
  { pattern: /\s+[A-Z0-9]{15,}$/g, replacement: '' },
  { pattern: /\s+[A-Z0-9]{10,}[A-Z0-9]*$/g, replacement: '' },
  
  // Remove payment method descriptions
  { pattern: /\s+Lastschrift\s+aus\s+Kartenzahlung.*$/i, replacement: '' },
  
  // Clean business name patterns
  { pattern: /\s+U\s+CO\s+KG.*$/, replacement: ' & Co KG' },
  { pattern: /\s+FIL\s+\d+.*$/, replacement: '' },
  
  // Clean up complex patterns
  { pattern: /^([A-Z][A-Za-z\s&.-]+?)\/\/.*$/, replacement: '$1' },
  { pattern: /^([A-Z][A-Za-z\s&.-]+?)\s+\/\s+.*$/, replacement: '$1' },
  
  // Normalize business suffixes
  { pattern: /\s+GMBH$/i, replacement: ' GmbH' },
  { pattern: /\s+UG$/i, replacement: ' UG' },
  { pattern: /\s+SPA$/i, replacement: ' SpA' },
  { pattern: /\s+SRL$/i, replacement: ' SRL' },
  
  // Clean up spaces
  { pattern: /\s+/g, replacement: '' }
]

const MERCHANT_REPLACEMENTS = [
  { pattern: /^DM\s.*/, replacement: 'DM Drogeriemarkt' },
  { pattern: /^KARSTADT\s+LEBENSM\..*/, replacement: 'Karstadt' },
  { pattern: /^KARSTADT(?:\s+.*)?$/, replacement: 'Karstadt' },
  { pattern: /^REWE\s+.*/, replacement: 'REWE' },
  { pattern: /^SPOTIFY\s.*/, replacement: 'Spotify' },
  { pattern: /^UBER\s+BV.*/, replacement: 'Uber' },
  { pattern: /^APPLE\s+STORE.*/, replacement: 'Apple Store' }
]

const PAYPAL_PATTERN = /(?:PP\.\d+\.PP\s*\.\s*|^\.\s*)([A-Z][A-Za-z0-9\s&.-]+?)(?:\s+Ihr\s+Einkauf|$)/
const ADYEN_PATTERN = /^([A-Za-z0-9\s&.-]+?)(?:\s+\d+|\s+L\s|\s+AWV-MELDEPFLICHT|$)/

function applyCleaningPatterns(title) {
  let cleanedTitle = title

  // Apply cleaning patterns
  for (const { pattern, replacement } of CLEANING_PATTERNS) {
    cleanedTitle = cleanedTitle.replace(pattern, replacement)
  }

  // Apply merchant replacements
  for (const { pattern, replacement } of MERCHANT_REPLACEMENTS) {
    cleanedTitle = cleanedTitle.replace(pattern, replacement)
  }

  return cleanedTitle.trim()
}

module.exports = {
  CLEANING_PATTERNS,
  MERCHANT_REPLACEMENTS,
  PAYPAL_PATTERN,
  ADYEN_PATTERN,
  applyCleaningPatterns
}