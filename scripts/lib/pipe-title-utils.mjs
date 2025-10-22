#!/usr/bin/env node

// Shared utilities for extracting and cleaning titles with pipe patterns
// Centralizes regex and input clamping to mitigate potential ReDoS risks.

export const MAX_REGEX_INPUT = 512
export const clampRegexInput = (s) => (typeof s === 'string' && s.length > MAX_REGEX_INPUT ? s.slice(0, MAX_REGEX_INPUT) : s)

export function extractPayPalTitle(description) {
  const desc = clampRegexInput(description || '')
  const match = desc.match(/(?:PP\.\d+\.PP\s*\.\s*|^\.\s*)([A-Z][A-Za-z0-9\s&.-]+?)(?:\s+Ihr\s+Einkauf|$)/)
  if (match && match[1]) {
    return match[1].trim()
  }
  const cleaned = desc
    .replace(/^PP\.\d+\.PP\s*\.\s*/, '')
    .replace(/^\.\s*/, '')
    .replace(/\s+Ihr\s+Einkauf.*$/, '')
    .replace(/\s+AWV-MELDEPFLICHT.*$/, '')
    .trim()
  return cleaned || desc
}

export function extractAdyenTitle(description) {
  const desc = clampRegexInput(description || '')
  const match = desc.match(/^([A-Za-z0-9\s&.-]+?)(?:\s+\d+|\s+L\s|\s+AWV-MELDEPFLICHT|$)/)
  if (match && match[1]) {
    return match[1].trim()
  }
  const cleaned = desc
    .replace(/\s+\d+.*$/, '')
    .replace(/\s+L\s.*$/, '')
    .replace(/\s+AWV-MELDEPFLICHT.*$/, '')
    .trim()
  return cleaned || desc
}

// Extract substring between first and second "||" and apply provider-specific rules
export function extractNewTitle(fullTitle) {
  const title = String(fullTitle ?? '')
  const firstIndex = title.indexOf('||')
  if (firstIndex === -1) return 'N/A'

  const secondIndex = title.indexOf('||', firstIndex + 2)
  if (secondIndex === -1) {
    return title.substring(firstIndex + 2).trim()
  }

  const merchantName = title.substring(firstIndex + 2, secondIndex).trim()
  if (merchantName.toLowerCase().includes('paypal')) {
    return extractPayPalTitle(title.substring(secondIndex + 2).trim())
  }
  if (merchantName.toLowerCase().includes('adyen')) {
    return extractAdyenTitle(title.substring(secondIndex + 2).trim())
  }
  return merchantName
}

// Clean extracted title from common strings and patterns
export function cleanTitle(title) {
  const input = clampRegexInput(String(title ?? ''))
  return input
    // Remove location patterns like "//BERLIN/DE" or "//Berlin Wedding/DE"
    .replaceAll(/\/\/[^/]+\/[A-Z]{2}(?:\/\d+)?\s*\/.*$/i, '')
    .replaceAll(/\/\/[^/]+\/[A-Z]{2}$/i, '')

    // Remove common purchase/transaction phrases
    .replaceAll(/\s+Your\s+purchase\s+at\s+(.+)$/i, '')
    .replaceAll(/\s+purchase\s+at\s+.+$/i, '')

    // Remove common German phrases and store codes
    .replaceAll(/\s+SAGT\s+DANKE?\.?\s*\d*$/i, '')
    .replaceAll(/\s+BEDANKT\s+SICH$/i, '')
    .replaceAll(/\s+SAGT\s+DANK$/i, '')

    // Remove store/branch codes and patterns
    .replaceAll(/\s+H:\d+/g, '')
    .replaceAll(/\s+FIL\.\d+/g, '')
    .replaceAll(/\s+R\d{3,}/g, '')
    .replaceAll(/\s+GIR\s+\d+/g, '')
    .replaceAll(/\s+\d{8,}/g, '')

    // Remove alphanumeric transaction/reference codes
    .replaceAll(/\s+[A-Z0-9]{15,}$/g, '')
    .replaceAll(/\s+[A-Z0-9]{10,}[A-Z0-9]*$/g, '')

    // Remove payment method descriptions
    .replace(/\s+Lastschrift\s+aus\s+Kartenzahlung.*$/i, '')

    // Clean business name patterns
    .replace(/\s+U\s+CO\s+KG.*$/, ' & Co KG')
    .replace(/\s+FIL\s+\d+.*$/, '')

    // Specific merchant name improvements
    .replace(/^DM\s.*/, 'DM Drogeriemarkt')
    .replace(/^KARSTADT\s+LEBENSM\..*/, 'Karstadt')
    .replace(/^KARSTADT(?:\s+.*)?$/, 'Karstadt')
    .replace(/^REWE\s+.*/, 'REWE')
    .replace(/^SPOTIFY\s.*/, 'Spotify')
    .replace(/^UBER\s+BV.*/, 'Uber')
    .replace(/^APPLE\s+STORE.*/, 'Apple Store')

    // Clean up complex patterns that still have locations/descriptions
    .replace(/^([A-Z][A-Za-z\s&.-]+?)\/\/.*$/, '$1')
    .replace(/^([A-Z][A-Za-z\s&.-]+?)\s+\/\s+.*$/, '$1')

    // Normalize business suffixes and whitespace
    .replace(/\s+GMBH$/i, ' GmbH')
    .replace(/\s+UG$/i, ' UG')
    .replace(/\s+SPA$/i, ' SpA')
    .replace(/\s+SRL$/i, ' SRL')
    .replaceAll(/\s+/g, ' ')
    .trim()
}
