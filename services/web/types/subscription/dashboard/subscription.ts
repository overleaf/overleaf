import { CurrencyCode } from '../currency'
import { Nullable } from '../../utils'
import {
  Plan,
  AddOn,
  PaymentProviderAddOn,
  PendingPaymentProviderPlan,
} from '../plan'
import { User } from '../../user'

export type SubscriptionState = 'active' | 'canceled' | 'expired' | 'paused'

// when puchasing a new add-on in recurly, we only need to provide the code
export type PurchasingAddOnCode = {
  code: string
}

type PaymentProviderCoupon = {
  code: string
  name: string
  description: string
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
  recurlySubscription_id: string
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

type PaymentProviderService = 'stripe' | 'recurly'

export type PaymentProvider = {
  service: PaymentProviderService
  subscriptionId: string
  state: SubscriptionState
  trialStartedAt?: Nullable<Date>
  trialEndsAt?: Nullable<Date>
}
