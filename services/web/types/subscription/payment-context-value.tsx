import countries from '@/features/subscription/data/countries'
import { Plan } from './plan'
import { SubscriptionPricingStateTax } from 'recurly__recurly-js'
import { SubscriptionPricingInstanceCustom } from '../recurly/pricing/subscription'
import { currencies, CurrencyCode, CurrencySymbol } from './currency'

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
  country: (typeof countries)[number]['code'] | ''
  coupon: string
}

export type PaymentContextValue = {
  currencyCode: CurrencyCode
  setCurrencyCode: React.Dispatch<
    React.SetStateAction<PaymentContextValue['currencyCode']>
  >
  currencySymbol: CurrencySymbol
  limitedCurrencies: Partial<typeof currencies>
  pricingFormState: PricingFormState
  setPricingFormState: React.Dispatch<
    React.SetStateAction<PaymentContextValue['pricingFormState']>
  >
  plan: Plan
  planCode: string
  planName: string
  planOffersFreeTrial: boolean
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
  changeCurrency: (newCurrency: CurrencyCode) => void
  updateCountry: (country: PricingFormState['country']) => void
  userCanNotStartRequestedTrial: boolean
}
