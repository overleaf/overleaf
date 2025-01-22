type SubscriptionBase = {
  featuresPageURL: string
}

export type FreePlanSubscription = {
  type: 'free'
} & SubscriptionBase

type FreeSubscription = FreePlanSubscription

type RecurlyStatus = {
  state: 'active' | 'canceled' | 'expired' | 'paused'
}

type PaidSubscriptionBase = {
  plan: {
    name: string
  }
  subscription: {
    teamName?: string
    name: string
    recurlyStatus?: RecurlyStatus
  }
} & SubscriptionBase

export type IndividualPlanSubscription = {
  type: 'individual'
  remainingTrialDays: number
} & PaidSubscriptionBase

export type GroupPlanSubscription = {
  type: 'group'
  remainingTrialDays: number
} & PaidSubscriptionBase

export type CommonsPlanSubscription = {
  type: 'commons'
} & PaidSubscriptionBase

type PaidSubscription =
  | IndividualPlanSubscription
  | GroupPlanSubscription
  | CommonsPlanSubscription

export type StandaloneAiAddOnSubscription = {
  type: 'standalone-ai-add-on'
}

export type Subscription =
  | FreeSubscription
  | PaidSubscription
  | StandaloneAiAddOnSubscription
