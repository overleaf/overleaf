import { CurrencyCode } from './currency'
import {
  PaymentProvider,
  StripePaymentProviderService,
} from './dashboard/subscription'
import { RecurlyPlanCode } from './plan'

type PaymentPageFormSubmitEventBaseSegmentation = {
  currencyCode: CurrencyCode
  plan_code?: string
  isPaypal: boolean
  upgradeType: 'standalone'
  referrer?: string
}

type PaymentPageFormSubmitEventStripeSegmentation =
  PaymentPageFormSubmitEventBaseSegmentation & {
    couponName?: string
    promotionCode?: string
    payment_provider: StripePaymentProviderService
    stripe_price_id: string
    stripe_price_lookup_key: string
  }

type PaymentPageFormSubmitEventRecurlySegmentation =
  PaymentPageFormSubmitEventBaseSegmentation & {
    coupon_code?: string
    payment_provider: Exclude<
      PaymentProvider['service'],
      'stripe-us' | 'stripe-uk'
    >
  }

export type PaymentPageFormSubmitEventSegmentation =
  | PaymentPageFormSubmitEventStripeSegmentation
  | PaymentPageFormSubmitEventRecurlySegmentation

type PaymentPageFormSuccessEventBaseSegmentation = {
  plan?: RecurlyPlanCode
  upgradeType: 'standalone'
  referrer?: string
}

type PaymentPageFormSuccessEventStripeSegmentation =
  PaymentPageFormSuccessEventBaseSegmentation & {
    payment_provider: StripePaymentProviderService
    stripe_price_id: string
    stripe_price_lookup_key: string
  }

type PaymentPageFormSuccessEventRecurlySegmentation =
  PaymentPageFormSuccessEventBaseSegmentation & {
    payment_provider: 'recurly'
  }

export type PaymentPageFormSuccessEventSegmentation =
  | PaymentPageFormSuccessEventStripeSegmentation
  | PaymentPageFormSuccessEventRecurlySegmentation
