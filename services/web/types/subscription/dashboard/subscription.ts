import { CurrencyCode } from '../currency'
import { Nullable } from '../../utils'
import {
  Plan,
  AddOn,
  PaymentProviderAddOn,
  PendingPaymentProviderPlan,
} from '../plan'
import { User } from '../../user'

export type SubscriptionState =
  | 'active'
  | 'canceled'
  | 'expired'
  | 'paused'
  | 'past_due'
  | 'incomplete'
  | 'incomplete_expired'

// when puchasing a new add-on in recurly, we only need to provide the code
export type PurchasingAddOnCode = {
  code: string
}

export type PaymentProviderCoupon = {
  code: string
  name: string
  description?: string
  isSingleUse?: boolean
  discountMonths?: number | null
}

type PaymentProviderRecord = {
  taxRate: number
  billingDetailsLink: string
  accountManagementLink: string
  additionalLicenses: number
  addOns: PaymentProviderAddOn[]
  totalLicenses: number
  nextPaymentDueAt: string
  nextPaymentDueDate: string
  currency: CurrencyCode
  state?: SubscriptionState
  trialEndsAtFormatted: Nullable<string>
  trialEndsAt: Nullable<string>
  activeCoupons: PaymentProviderCoupon[]
  accountEmail: string
  hasPastDueInvoice: boolean
  displayPrice: string
  planOnlyDisplayPrice: string
  addOnDisplayPricesWithoutAdditionalLicense: Record<string, string>
  pendingAdditionalLicenses?: number
  pendingTotalLicenses?: number
  pausedAt?: Nullable<string>
  remainingPauseCycles?: Nullable<number>
  isEligibleForPause: boolean
  isEligibleForGroupPlan: boolean
  isEligibleForDowngradeUpsell: boolean
}

export type GroupPolicy = {
  [policy: string]: boolean
}

export type Subscription = {
  _id: string
  admin_id: string
  manager_ids: string[]
  member_ids: string[]
  invited_emails: string[]
  groupPlan: boolean
  groupPolicy?: GroupPolicy
  membersLimit: number
  teamInvites: object[]
  planCode: string
  plan: Plan
  pendingPlan?: PendingPaymentProviderPlan
  addOns?: AddOn[]
}

export type PaidSubscription = Subscription & {
  payment: PaymentProviderRecord
}

export type CustomSubscription = Subscription & {
  customAccount: boolean
}

export type GroupSubscription = PaidSubscription & {
  teamName: string
  teamNotice?: string
}

export type ManagedGroupSubscription = {
  _id: string
  userIsGroupMember: boolean
  planLevelName: string
  admin_id: {
    email: string
  }
  features: {
    groupSSO: boolean | null
    managedUsers: boolean | null
  }
  teamName?: string
}

export type MemberGroupSubscription = Omit<GroupSubscription, 'admin_id'> & {
  userIsGroupManager: boolean
  planLevelName: string
  admin_id: User
}

const STRIPE_PAYMENT_PROVIDER_SERVICES = ['stripe-uk', 'stripe-us'] as const
const PAYMENT_PROVIDER_SERVICES = [
  ...STRIPE_PAYMENT_PROVIDER_SERVICES,
  'recurly',
] as const

export type PaymentProviderService = (typeof PAYMENT_PROVIDER_SERVICES)[number]
export type StripePaymentProviderService =
  (typeof STRIPE_PAYMENT_PROVIDER_SERVICES)[number]

export type PaymentProvider = {
  service: PaymentProviderService
  subscriptionId: string
  state: SubscriptionState
  trialStartedAt?: Nullable<Date>
  trialEndsAt?: Nullable<Date>
}

export type SubscriptionRequesterData = {
  id?: string
  ip?: string
}

export type SubscriptionBillingAddress = {
  line1?: string
  line2?: string
  city?: string
  state?: string
  postal_code: string
  country: string
}

export type StripeBusinessDetails = {
  name?: string
  taxIdType?: string
  taxIdValue?: string
  isTaxExempt?: boolean
}
