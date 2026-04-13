import getMeta from '@/utils/meta'

const DEFAULT_LOCALE = getMeta('ol-i18n')?.currentLangCode ?? 'en'

const ZERO_DECIMAL_CURRENCIES = ['clp', 'jpy', 'krw', 'vnd']

export function formatCurrency(
  amount: number,
  currency: string,
  locale: string = DEFAULT_LOCALE,
  stripIfInteger = false
): string {
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(currency.toLowerCase())
  const fractionDigits = isZeroDecimal ? 0 : 2

  const options: Intl.NumberFormatOptions = {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }
  if (stripIfInteger && Number.isInteger(amount)) {
    options.minimumFractionDigits = 0
  }

  try {
    return amount.toLocaleString(locale, {
      ...options,
      currencyDisplay: 'narrowSymbol',
    })
  } catch {}

  try {
    return amount.toLocaleString(locale, options)
  } catch {}

  return `${currency} ${amount}`
}

export function convertToMinorUnits(amount: number, currency: string): number {
  const isNoCentsCurrency = ['clp', 'jpy', 'krw', 'vnd'].includes(
    currency.toLowerCase()
  )

  // Determine the multiplier based on currency
  let multiplier = 100 // default for most currencies (2 decimal places)

  if (isNoCentsCurrency) {
    multiplier = 1 // no decimal places
  }

  // Convert and round to an integer
  return Math.round(amount * multiplier)
}
