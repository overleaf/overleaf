import {
  SubscriptionPricingInstance,
  SubscriptionPricingState,
  Address,
  Tax,
} from 'recurly__recurly-js'

export interface Plan {
  code: string
  name: string
  period: {
    interval: string
    length: number
  }
  price: Record<
    string,
    {
      unit_amount: number
      symbol: string
      setup_fee: number
    }
  >
  quantity: number
  tax_code: string
  tax_exempt: boolean
  trial?: {
    interval: string
    length: number
  }
}

interface Coupon {
  code: string
  name: string
  discount: {
    type: string
    rate: number
  }
  single_use: boolean
  applies_for_months: number
  duration: string
  temporal_unit: string
  temporal_amount: number
  plans: unknown[]
  applies_to_non_plan_charges: boolean
  applies_to_plans: boolean
  applies_to_all_plans: boolean
  redemption_resource: string
}

interface AddOn {
  code: string
  quantity: number
}

// Extending the default interface as it lacks the `items` prop
export interface SubscriptionPricingInstanceCustom
  extends SubscriptionPricingInstance, SubscriptionPricingState {
  id: string
  items: {
    addons: AddOn[]
    address?: Address
    coupon?: Coupon
    currency: string
    plan?: Plan
    tax?: Tax
  }
}
