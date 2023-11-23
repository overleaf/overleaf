import {
  CommonsPlanSubscription,
  FreePlanSubscription,
  GroupPlanSubscription,
  IndividualPlanSubscription,
} from '../../../../../types/project/dashboard/subscription'

export const freeSubscription: FreePlanSubscription = {
  type: 'free',
  featuresPageURL: '/features',
}

export const individualSubscription: IndividualPlanSubscription = {
  type: 'individual',
  plan: { name: 'professional' },
  featuresPageURL: '/features',
  remainingTrialDays: -1,
  subscription: {
    name: 'professional',
  },
}

export const commonsSubscription: CommonsPlanSubscription = {
  type: 'commons',
  plan: { name: 'professional' },
  featuresPageURL: '/features',
  subscription: {
    name: 'professional',
  },
}

export const groupSubscription: GroupPlanSubscription = {
  type: 'group',
  plan: { name: 'professional' },
  featuresPageURL: '/features',
  remainingTrialDays: -1,
  subscription: {
    name: 'professional',
    teamName: 'My group',
  },
}
