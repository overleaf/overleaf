import { SubscriptionPricingState } from '@recurly/recurly-js'
import { currencies, CurrencyCode } from '../data/currency'

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

function priceWithCents(price: number): string | number {
  return price % 1 !== 0 ? price.toFixed(2) : price
}

export function formatPriceForDisplayData(
  price: string,
  taxRate: number,
  currencyCode: CurrencyCode
) {
  const currencySymbol = currencies[currencyCode]

  const totalPriceExTax = parseFloat(price)
  let taxAmount = totalPriceExTax * taxRate
  if (isNaN(taxAmount)) {
    taxAmount = 0
  }
  const totalWithTax = totalPriceExTax + taxAmount

  return {
    totalForDisplay: `${currencySymbol}${priceWithCents(totalWithTax)}`,
    totalAsNumber: totalWithTax,
    subtotal: `${currencySymbol}${totalPriceExTax.toFixed(2)}`,
    tax: `${currencySymbol}${taxAmount.toFixed(2)}`,
    includesTax: taxAmount !== 0,
  }
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
