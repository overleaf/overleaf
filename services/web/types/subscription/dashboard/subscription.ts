import { Nullable } from '../../utils'
import { Plan } from '../plan'
import { User } from '../../../types/user'

type SubscriptionState = 'active' | 'canceled' | 'expired'

export type Subscription = {
  _id: string
  admin_id: string
  manager_ids: string[]
  member_ids: string[]
  invited_emails: string[]
  groupPlan: boolean
  membersLimit: number
  teamInvites: object[]
  planCode: string
  recurlySubscription_id: string
  plan: Plan
  recurly: {
    tax: number
    taxRate: number
    billingDetailsLink: string
    accountManagementLink: string
    additionalLicenses: number
    totalLicenses: number
    nextPaymentDueAt: string
    currency: string
    state?: SubscriptionState
    trialEndsAtFormatted: Nullable<string>
    trial_ends_at: Nullable<string>
    activeCoupons: any[] // TODO: confirm type in array
    account: {
      // data via Recurly API
      has_canceled_subscription: {
        _: 'false' | 'true'
        $: {
          type: 'boolean'
        }
      }
      has_past_due_invoice: {
        _: 'false' | 'true'
        $: {
          type: 'boolean'
        }
      }
    }
    displayPrice: string
    currentPlanDisplayPrice?: string
    pendingAdditionalLicenses?: number
    pendingTotalLicenses?: number
  }
  pendingPlan?: Plan
}

export type GroupSubscription = Subscription & {
  teamName: string
}

export type ManagedGroupSubscription = Omit<GroupSubscription, 'admin_id'> & {
  userIsGroupMember: boolean
  planLevelName: string
  admin_id: User
}
