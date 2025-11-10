import { ImmediateCharge } from './subscription-change-preview'
import { PaymentProviderCoupon } from './dashboard/subscription'
import { Plan } from './plan'

export type SubscriptionCreationPreview = {
  immediateCharge: ImmediateCharge
  taxRate: number
  billingCycleInterval: 'month' | 'year'
  coupon: PaymentProviderCoupon
  priceId: string
  lookupKey: string
  trialLength: number | null
  plan: Plan
  warnings?: Record<string, string>
}
