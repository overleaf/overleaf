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
}

export type CurrencyCode = keyof typeof currencies
