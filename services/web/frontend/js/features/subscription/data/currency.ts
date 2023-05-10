export const currencies = <const>{
  USD: '$',
  EUR: '€',
  GBP: '£',
  SEK: 'kr',
  CAD: '$',
  NOK: 'kr',
  DKK: 'kr',
  AUD: '$',
  NZD: '$',
  CHF: 'Fr',
  SGD: '$',
  INR: '₹',
}

type Currency = typeof currencies
export type CurrencyCode = keyof Currency
export type CurrencySymbol = Currency[CurrencyCode]
