import { ImmediateCharge } from './subscription-change-preview'
import { PaymentProviderCoupon } from './dashboard/subscription'
import { Plan } from './plan'

export type SubscriptionCreationPreview = {
  immediateCharge: ImmediateCharge
  taxRate: number
  billingCycleInterval: 'month' | 'year'
  coupon: PaymentProviderCoupon
  trialLength: number | null
  plan: Plan
}
