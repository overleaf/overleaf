export type CurrencyCode =
  | 'AUD'
  | 'BRL'
  | 'CAD'
  | 'CHF'
  | 'CLP'
  | 'COP'
  | 'DKK'
  | 'EUR'
  | 'GBP'
  | 'INR'
  | 'MXN'
  | 'NOK'
  | 'NZD'
  | 'PEN'
  | 'SEK'
  | 'SGD'
  | 'USD'

export function formatCurrencyLocalized(
  amount: number,
  currency: CurrencyCode,
  locale: string,
  stripIfInteger = false
): string {
  const options: Intl.NumberFormatOptions = { style: 'currency', currency }
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
