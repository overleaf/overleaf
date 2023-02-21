import { SubscriptionPricingState } from '@recurly/recurly-js'
import { PriceForDisplayData } from '../../../../../types/subscription/plan'
import { currencies, CurrencyCode } from '../data/currency'
import { getRecurlyGroupPlanCode } from './recurly-group-plan-code'

function queryRecurlyPlanPrice(planCode: string, currency: CurrencyCode) {
  return new Promise(resolve => {
    recurly.Pricing.Subscription()
      .plan(planCode, { quantity: 1 })
      .currency(currency)
      .catch(function (error) {
        console.error(error)
      })
      .done(response => {
        if (response) {
          resolve(response)
        } else {
          resolve(undefined)
        }
      })
  })
}

function priceToWithCents(price: number) {
  return price % 1 !== 0 ? price.toFixed(2) : price
}

export function formatPriceForDisplayData(
  price: string,
  taxRate: number,
  currencyCode: CurrencyCode
): PriceForDisplayData {
  const currencySymbol = currencies[currencyCode]

  const totalPriceExTax = parseFloat(price)
  let taxAmount = totalPriceExTax * taxRate
  if (isNaN(taxAmount)) {
    taxAmount = 0
  }
  const totalWithTax = totalPriceExTax + taxAmount

  return {
    totalForDisplay: `${currencySymbol}${priceToWithCents(totalWithTax)}`,
    totalAsNumber: totalWithTax,
    subtotal: `${currencySymbol}${totalPriceExTax.toFixed(2)}`,
    tax: `${currencySymbol}${taxAmount.toFixed(2)}`,
    includesTax: taxAmount !== 0,
  }
}

function getPerUserDisplayPrice(
  totalPrice: number,
  currencySymbol: string,
  size: string
): string {
  return `${currencySymbol}${priceToWithCents(totalPrice / parseInt(size))}`
}

export async function loadDisplayPriceWithTaxPromise(
  planCode: string,
  currencyCode: CurrencyCode,
  taxRate: number
) {
  if (!recurly) return

  const price = (await queryRecurlyPlanPrice(
    planCode,
    currencyCode
  )) as SubscriptionPricingState['price']
  if (price)
    return formatPriceForDisplayData(price.next.total, taxRate, currencyCode)
}

export async function loadGroupDisplayPriceWithTaxPromise(
  groupPlanCode: string,
  currencyCode: CurrencyCode,
  taxRate: number,
  size: string,
  usage: string
) {
  if (!recurly) return

  const planCode = getRecurlyGroupPlanCode(groupPlanCode, size, usage)
  const price = await loadDisplayPriceWithTaxPromise(
    planCode,
    currencyCode,
    taxRate
  )

  if (price) {
    const currencySymbol = currencies[currencyCode]
    price.perUserDisplayPrice = getPerUserDisplayPrice(
      price.totalAsNumber,
      currencySymbol,
      size
    )
  }

  return price
}
