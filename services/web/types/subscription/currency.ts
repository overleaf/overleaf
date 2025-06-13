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
  BRL: 'R$',
  MXN: '$',
  COP: '$',
  CLP: '$',
  PEN: 'S/',
}

type Currency = typeof currencies
export type CurrencyCode = keyof Currency
export type StripeCurrencyCode = Lowercase<CurrencyCode>
