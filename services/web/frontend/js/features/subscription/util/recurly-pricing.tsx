import { SubscriptionPricingState } from '@recurly/recurly-js'
import getMeta from '../../../utils/meta'
import { currencies, CurrencyCode } from '../data/currency'

export function formatPriceForDisplayData(price: string, taxRate: number) {
  const currencyCode: CurrencyCode = getMeta('ol-recommendedCurrency')
  const currencySymbol = currencies[currencyCode]

  const totalPriceExTax = parseFloat(price)
  let taxAmount = totalPriceExTax * taxRate
  if (isNaN(taxAmount)) {
    taxAmount = 0
  }
  const totalWithTax = totalPriceExTax + taxAmount

  return {
    totalForDisplay: `${currencySymbol}${
      totalWithTax % 1 !== 0 ? totalWithTax.toFixed(2) : totalWithTax
    }`,
    totalAsNumber: totalWithTax,
    subtotal: `${currencySymbol}${totalPriceExTax.toFixed(2)}`,
    tax: `${currencySymbol}${taxAmount.toFixed(2)}`,
    includesTax: taxAmount !== 0,
  }
}

export function loadDisplayPriceWithTaxPromise(
  planCode: string,
  currency: CurrencyCode,
  taxRate: number
) {
  if (!recurly) return

  return new Promise<ReturnType<typeof formatPriceForDisplayData> | undefined>(
    resolve => {
      recurly.Pricing.Subscription()
        .plan(planCode, { quantity: 1 })
        .currency(currency)
        .catch(function (error) {
          console.error(error)
        })
        .done(response => {
          if (response) {
            const price =
              response as unknown as SubscriptionPricingState['price']
            // type expects response to be {price: {next: ...}}
            // but the real response is {next: ...}
            const data = formatPriceForDisplayData(price.next.total, taxRate)
            resolve(data)
          } else {
            resolve(undefined)
          }
        })
    }
  )
}
