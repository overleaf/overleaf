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
  if (stripIfInteger && Number.isInteger(amount)) {
    return amount.toLocaleString(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      currencyDisplay: 'narrowSymbol',
    })
  }
  return amount.toLocaleString(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  })
}
