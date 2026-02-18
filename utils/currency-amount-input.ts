export function getCurrencyFractionDigits(currency: string): number {
  try {
    const options = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).resolvedOptions()
    return options.maximumFractionDigits ?? 2
  } catch {
    return 2
  }
}

export function normalizeAmountForCurrencyInput(value: string, currency: string): string {
  const maxFractionDigits = getCurrencyFractionDigits(currency)
  const normalized = value.replace(/,/g, '.').replace(/[^\d.]/g, '')

  const firstDot = normalized.indexOf('.')
  if (firstDot === -1) {
    return normalized
  }

  const integerPart = normalized.slice(0, firstDot)
  const decimalsRaw = normalized.slice(firstDot + 1).replace(/\./g, '')

  if (maxFractionDigits <= 0) {
    return integerPart
  }

  return `${integerPart}.${decimalsRaw.slice(0, maxFractionDigits)}`
}

export function formatAmountForCurrencyInput(value: string, currency: string): string {
  const normalized = normalizeAmountForCurrencyInput(value, currency)
  if (!normalized) return ''

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return normalized

  const maxFractionDigits = getCurrencyFractionDigits(currency)
  return parsed.toLocaleString('en-US', {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  })
}
