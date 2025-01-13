import getMeta from '@/utils/meta'

const DEFAULT_LOCALE = getMeta('ol-i18n')?.currentLangCode ?? 'en'

export function formatCurrency(
  amount: number,
  currency: string,
  locale: string = DEFAULT_LOCALE,
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
