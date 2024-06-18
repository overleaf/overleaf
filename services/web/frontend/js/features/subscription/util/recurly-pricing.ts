import { SubscriptionPricingState } from '@recurly/recurly-js'
import { PriceForDisplayData } from '../../../../../types/subscription/plan'
import {
  currencies,
  CurrencyCode,
} from '../../../../../types/subscription/currency'
import { getRecurlyGroupPlanCode } from './recurly-group-plan-code'
import { debugConsole } from '@/utils/debugging'

function queryRecurlyPlanPrice(planCode: string, currency: CurrencyCode) {
  return new Promise(resolve => {
    recurly.Pricing.Subscription()
      .plan(planCode, { quantity: 1 })
      .currency(currency)
      .catch(debugConsole.error)
      .done(response => {
        if (response) {
          resolve(response)
        } else {
          resolve(undefined)
        }
      })
  })
}

type FormatCurrency = (
  price: number,
  currency: CurrencyCode,
  locale: string,
  stripIfInteger?: boolean
) => string

export const formatCurrencyDefault: FormatCurrency = (
  price: number,
  currency: CurrencyCode,
  _locale: string,
  stripIfInteger = false
) => {
  const currencySymbol = currencies[currency]
  const number =
    stripIfInteger && price % 1 === 0 ? Number(price) : price.toFixed(2)
  return `${currencySymbol}${number}`
}

export function formatPriceForDisplayData(
  price: string,
  taxRate: number,
  currencyCode: CurrencyCode,
  locale: string,
  formatCurrency: FormatCurrency
): PriceForDisplayData {
  const totalPriceExTax = parseFloat(price)
  let taxAmount = totalPriceExTax * taxRate
  if (isNaN(taxAmount)) {
    taxAmount = 0
  }
  const totalWithTax = totalPriceExTax + taxAmount

  return {
    totalForDisplay: formatCurrency(totalWithTax, currencyCode, locale, true),
    totalAsNumber: totalWithTax,
    subtotal: formatCurrency(totalPriceExTax, currencyCode, locale),
    tax: formatCurrency(taxAmount, currencyCode, locale),
    includesTax: taxAmount !== 0,
  }
}

function getPerUserDisplayPrice(
  totalPrice: number,
  currency: CurrencyCode,
  size: string,
  locale: string,
  formatCurrency: FormatCurrency
): string {
  return formatCurrency(totalPrice / parseInt(size), currency, locale, true)
}

export async function loadDisplayPriceWithTaxPromise(
  planCode: string,
  currencyCode: CurrencyCode,
  taxRate: number,
  locale: string,
  formatCurrency: FormatCurrency
) {
  if (!recurly) return

  const price = (await queryRecurlyPlanPrice(
    planCode,
    currencyCode
  )) as SubscriptionPricingState['price']
  if (price)
    return formatPriceForDisplayData(
      price.next.total,
      taxRate,
      currencyCode,
      locale,
      formatCurrency
    )
}

export async function loadGroupDisplayPriceWithTaxPromise(
  groupPlanCode: string,
  currencyCode: CurrencyCode,
  taxRate: number,
  size: string,
  usage: string,
  locale: string,
  formatCurrency: FormatCurrency
) {
  if (!recurly) return

  const planCode = getRecurlyGroupPlanCode(groupPlanCode, size, usage)
  const price = await loadDisplayPriceWithTaxPromise(
    planCode,
    currencyCode,
    taxRate,
    locale,
    formatCurrency
  )

  if (price) {
    price.perUserDisplayPrice = getPerUserDisplayPrice(
      price.totalAsNumber,
      currencyCode,
      size,
      locale,
      formatCurrency
    )
  }

  return price
}
