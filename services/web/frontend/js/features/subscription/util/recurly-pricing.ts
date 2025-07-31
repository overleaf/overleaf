import { SubscriptionPricingState } from '@recurly/recurly-js'
import { PriceForDisplayData } from '../../../../../types/subscription/plan'
import { CurrencyCode } from '../../../../../types/subscription/currency'
import {
  getRecurlyGroupPlanCode,
  getConsolidatedGroupPlanCode,
} from './recurly-group-plan-code'
import { debugConsole } from '@/utils/debugging'
import { formatCurrency } from '@/shared/utils/currency'
import { getJSON } from '../../../infrastructure/fetch-json'

let groupPlanPerUserPrices: Record<string, number> | undefined

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

export function formatPriceForDisplayData(
  price: string,
  taxRate: number,
  currencyCode: CurrencyCode,
  locale: string
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
  locale: string
): string {
  return formatCurrency(totalPrice / parseInt(size), currency, locale, true)
}

export async function loadDisplayPriceWithTaxPromise(
  planCode: string,
  currencyCode: CurrencyCode,
  taxRate: number,
  locale: string
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
      locale
    )
}

export async function loadGroupDisplayPriceWithTaxForRecurlyPromise(
  groupPlanCode: string,
  currencyCode: CurrencyCode,
  taxRate: number,
  size: string,
  usage: string,
  locale: string
) {
  if (!recurly) return

  const planCode = getRecurlyGroupPlanCode(groupPlanCode, size, usage)
  const price = await loadDisplayPriceWithTaxPromise(
    planCode,
    currencyCode,
    taxRate,
    locale
  )

  if (price) {
    price.perUserDisplayPrice = getPerUserDisplayPrice(
      price.totalAsNumber,
      currencyCode,
      size,
      locale
    )
  }

  return price
}

export async function loadGroupDisplayPriceWithTaxForStripePromise(
  groupPlanCode: string,
  currencyCode: CurrencyCode,
  taxRate: number,
  size: string,
  usage: string,
  locale: string
) {
  if (!groupPlanPerUserPrices) {
    groupPlanPerUserPrices = await getJSON<Record<string, number>>(
      `/user/subscription/group/group-plan-per-user-prices?currency=${currencyCode}`
    )
  }

  const planCode = getConsolidatedGroupPlanCode(groupPlanCode, usage)

  if (!(planCode in groupPlanPerUserPrices)) {
    throw new Error(
      `Group plan code ${planCode} not found in groupPlanPerUserPrices`
    )
  }

  const subtotalPrice = groupPlanPerUserPrices[planCode] * parseInt(size)

  const result = formatPriceForDisplayData(
    subtotalPrice.toString(),
    taxRate,
    currencyCode,
    locale
  )

  result.perUserDisplayPrice = formatCurrency(
    groupPlanPerUserPrices[planCode],
    currencyCode,
    locale,
    true
  )

  return result
}
