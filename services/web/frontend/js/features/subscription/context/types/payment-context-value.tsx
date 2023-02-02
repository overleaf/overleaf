import countries from '../../data/countries'
import { Plan } from '../../../../../../types/subscription/plan'
import { SubscriptionPricingStateTax } from 'recurly__recurly-js'
import { SubscriptionPricingInstanceCustom } from '../../../../../../types/recurly/pricing/subscription'

export type PricingFormState = {
  first_name: string
  last_name: string
  postal_code: string
  address1: string
  address2: string
  state: string
  city: string
  company: string
  vat_number: string
  country: typeof countries[number]['code'] | ''
  coupon: string
}

export type PaymentContextValue = {
  currencyCode: string
  setCurrencyCode: React.Dispatch<
    React.SetStateAction<PaymentContextValue['currencyCode']>
  >
  currencySymbol: string
  limitedCurrencies: Record<
    PaymentContextValue['currencyCode'],
    PaymentContextValue['currencySymbol']
  >
  pricingFormState: PricingFormState
  setPricingFormState: React.Dispatch<
    React.SetStateAction<PaymentContextValue['pricingFormState']>
  >
  plan: Plan
  pricing: React.MutableRefObject<SubscriptionPricingInstanceCustom | undefined>
  recurlyLoading: boolean
  recurlyLoadError: boolean
  recurlyPrice:
    | {
        subtotal: string
        plan: string
        addons: string
        setup_fee: string
        discount: string
        tax: string
        total: string
      }
    | undefined
  monthlyBilling: boolean | undefined
  taxes: SubscriptionPricingStateTax[]
  coupon:
    | {
        discountMonths?: number
        discountRate?: number
        singleUse: boolean
        normalPrice: number
        name: string
        normalPriceWithoutTax: number
      }
    | undefined
  couponError: string
  trialLength: number | undefined
  applyVatNumber: (vatNumber: PricingFormState['vat_number']) => void
  addCoupon: (coupon: PricingFormState['coupon']) => void
  changeCurrency: (newCurrency: string) => void
  updateCountry: (country: PricingFormState['country']) => void
}
