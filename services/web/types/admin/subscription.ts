import {
  GroupPolicy,
  PaymentProvider,
} from '../subscription/dashboard/subscription'
import { SSOConfig } from '../subscription/sso'
import { TeamInvite } from '../team-invite'

type RecurlyAdminClientPaymentProvider = Record<string, never>
type StripeAdminClientPaymentProvider = PaymentProvider & {
  service: 'stripe-us' | 'stripe-uk'
}

export type Subscription = {
  _id: string
  teamInvites: TeamInvite[]
  groupPolicy: GroupPolicy
  admin_id: string
  groupPlan: boolean
  customAccount: boolean
  ssoConfig: SSOConfig
  domainCaptureEnabled?: boolean
  managedUsersEnabled: boolean
  v1_id: number
  salesforce_id: string
  recurlySubscription_id?: string
  paymentProvider:
    | RecurlyAdminClientPaymentProvider
    | StripeAdminClientPaymentProvider
  features: {
    domainCapture?: boolean
  }
}
