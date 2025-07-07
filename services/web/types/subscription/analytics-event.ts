import { CurrencyCode } from './currency'
import { PaymentProvider } from './dashboard/subscription'

type PaymentPageFormSubmitEventBaseSegmentation = {
  currencyCode: CurrencyCode
  plan_code?: string
  coupon_code: string
  isPaypal: boolean
  upgradeType: 'standalone'
  referrer?: string
}

type PaymentPageFormSubmitEventStripeSegmentation =
  PaymentPageFormSubmitEventBaseSegmentation & {
    payment_provider: Exclude<PaymentProvider['service'], 'recurly'>
    stripe_price_id: string
    stripe_price_lookup_key: string
  }

type PaymentPageFormSubmitEventRecurlySegmentation =
  PaymentPageFormSubmitEventBaseSegmentation & {
    payment_provider: Exclude<
      PaymentProvider['service'],
      'stripe-us' | 'stripe-uk'
    >
  }

export type PaymentPageFormSubmitEventSegmentation =
  | PaymentPageFormSubmitEventStripeSegmentation
  | PaymentPageFormSubmitEventRecurlySegmentation
