type FreePlanSubscription = {
  type: 'free'
}

type FreeSubscription = FreePlanSubscription

type PaidSubscriptionBase = {
  plan: {
    name: string
  }
  subscription: {
    teamName?: string
    name: string
  }
}

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

export type Subscription = FreeSubscription | PaidSubscription
