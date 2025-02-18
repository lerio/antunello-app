type CurrencyConfig = {
  locale: string
  currency: string
}

const CURRENCY_FORMATS: Record<string, CurrencyConfig> = {
  EUR: { locale: 'it-IT', currency: 'EUR' },
  USD: { locale: 'en-US', currency: 'USD' },
  JPY: { locale: 'ja-JP', currency: 'JPY' },
}

export function formatCurrency(amount: number, currency: string): string {
  const config = CURRENCY_FORMATS[currency] || CURRENCY_FORMATS.EUR

  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(amount)
} 