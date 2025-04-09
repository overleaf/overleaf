import { CurrencyCode } from '../currency'
import { Nullable } from '../../utils'
import { Plan, AddOn, RecurlyAddOn, PendingRecurlyPlan } from '../plan'
import { User } from '../../user'

type SubscriptionState = 'active' | 'canceled' | 'expired' | 'paused'

// when puchasing a new add-on in recurly, we only need to provide the code
export type PurchasingAddOnCode = {
  code: string
}

type RecurlyCoupon = {
  code: string
  name: string
  description: string
}

type Recurly = {
  tax: number
  taxRate: number
  billingDetailsLink: string
  accountManagementLink: string
  additionalLicenses: number
  addOns: RecurlyAddOn[]
  totalLicenses: number
  nextPaymentDueAt: string
  nextPaymentDueDate: string
  currency: CurrencyCode
  state?: SubscriptionState
  trialEndsAtFormatted: Nullable<string>
  trialEndsAt: Nullable<string>
  activeCoupons: RecurlyCoupon[]
  accountEmail: string
  hasPastDueInvoice: boolean
  displayPrice: string
  planOnlyDisplayPrice: string
  addOnDisplayPricesWithoutAdditionalLicense: Record<string, string>
  currentPlanDisplayPrice?: string
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
  pendingPlan?: PendingRecurlyPlan
  addOns?: AddOn[]
}

export type RecurlySubscription = Subscription & {
  recurly: Recurly
}

export type CustomSubscription = Subscription & {
  customAccount: boolean
}

export type GroupSubscription = RecurlySubscription & {
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
