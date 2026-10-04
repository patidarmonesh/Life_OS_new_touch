const FALLBACK_CURRENCY = 'INR'
const FALLBACK_SYMBOL = '₹'
const SYMBOL_TO_CODE = {
  '₹': 'INR',
  '$': 'USD',
  '€': 'EUR',
}

export function normalizeCurrency(currency) {
  if (!currency) return FALLBACK_CURRENCY
  const fromSymbol = SYMBOL_TO_CODE[currency]
  if (fromSymbol) return fromSymbol
  return String(currency).toUpperCase()
}

export function getCurrencySymbol(currency) {
  const code = normalizeCurrency(currency)
  try {
    const parts = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0)
    return parts.find(part => part.type === 'currency')?.value || code
  } catch {
    return FALLBACK_SYMBOL
  }
}

export function formatCurrencyAmount(amount, currency, options = {}) {
  const code = normalizeCurrency(currency)
  const value = Number(amount) || 0
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: options.minimumFractionDigits ?? 0,
      maximumFractionDigits: options.maximumFractionDigits ?? 0,
    }).format(value)
  } catch {
    return `${getCurrencySymbol(code)}${value.toLocaleString('en-IN')}`
  }
}
