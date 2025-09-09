import React from 'react'
import { ActiveSubscription } from '../../js/features/subscription/components/dashboard/states/active/active'
import {
  annualActiveSubscription,
  groupActiveSubscription,
  groupActiveSubscriptionWithPendingLicenseChange,
  monthlyActiveCollaborator,
  pendingSubscriptionChange,
  trialCollaboratorSubscription,
  trialSubscription,
  pastDueExpiredSubscription,
  annualActiveSubscriptionEuro,
  annualActiveSubscriptionWithAddons,
  annualActiveSubscriptionWithCoupons,
  pendingPausedSubscription,
  groupProfessionalActiveSubscription,
} from '../../../test/frontend/features/subscription/fixtures/subscriptions'
import { SubscriptionDashboardProvider } from '../../js/features/subscription/context/subscription-dashboard-context'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import { PaidSubscription } from '@ol-types/subscription/dashboard/subscription'
import type { StoryFn } from '@storybook/react'
import { setupSubscriptionDashContext } from '../../../test/frontend/features/subscription/helpers/setup-subscription-dash-context'

export default {
  title: 'Subscription/ActiveSubscription',
  component: ActiveSubscription,
  argTypes: {
    subscription: { control: 'object' },
    canUseFlexibleLicensing: { control: 'boolean' },
  },
}

const Template: StoryFn<{
  subscription: PaidSubscription
  canUseFlexibleLicensing: boolean
}> = args => {
  window.metaAttributesCache = window.metaAttributesCache || new Map()
  // @ts-ignore
  delete global.recurly
  setupSubscriptionDashContext({
    metaTags: [
      { name: 'ol-subscription', value: args.subscription },
      {
        name: 'ol-canUseFlexibleLicensing',
        value: args.canUseFlexibleLicensing,
      },
    ],
    currencyCode: args.subscription.payment.currency,
    recurlyNotLoaded: false,
    queryingRecurly: false,
  })
  return (
    <SplitTestProvider>
      <SubscriptionDashboardProvider>
        <ActiveSubscription {...args} />
      </SubscriptionDashboardProvider>
    </SplitTestProvider>
  )
}

export const CollaboratorAnnual = Template.bind({})
CollaboratorAnnual.args = {
  subscription: annualActiveSubscription,
  canUseFlexibleLicensing:
    annualActiveSubscription.plan?.canUseFlexibleLicensing,
}

export const CollaboratorMonthly = Template.bind({})
CollaboratorMonthly.args = {
  subscription: monthlyActiveCollaborator,
  canUseFlexibleLicensing:
    monthlyActiveCollaborator.plan?.canUseFlexibleLicensing,
}

export const CollaboratorAnnualEuro = Template.bind({})
CollaboratorAnnualEuro.args = {
  subscription: annualActiveSubscriptionEuro,
  canUseFlexibleLicensing:
    annualActiveSubscriptionEuro.plan?.canUseFlexibleLicensing,
}

export const CollaboratorTrial = Template.bind({})
CollaboratorTrial.args = {
  subscription: trialCollaboratorSubscription,
  canUseFlexibleLicensing:
    trialCollaboratorSubscription.plan?.canUseFlexibleLicensing,
}

export const PersonalTrial = Template.bind({})
PersonalTrial.args = {
  subscription: trialSubscription,
  canUseFlexibleLicensing: trialSubscription.plan?.canUseFlexibleLicensing,
}

export const GroupStandard = Template.bind({})
GroupStandard.args = {
  subscription: groupActiveSubscription,
  canUseFlexibleLicensing:
    groupActiveSubscription.plan?.canUseFlexibleLicensing,
}

export const GroupProfessional = Template.bind({})
GroupProfessional.args = {
  subscription: groupProfessionalActiveSubscription,
  canUseFlexibleLicensing:
    groupProfessionalActiveSubscription.plan?.canUseFlexibleLicensing,
}

export const GroupPendingLicenseChange = Template.bind({})
GroupPendingLicenseChange.args = {
  subscription: groupActiveSubscriptionWithPendingLicenseChange,
  canUseFlexibleLicensing:
    groupActiveSubscriptionWithPendingLicenseChange.plan
      ?.canUseFlexibleLicensing,
}

export const PastDueExpired = Template.bind({})
PastDueExpired.args = {
  subscription: pastDueExpiredSubscription,
  canUseFlexibleLicensing:
    pastDueExpiredSubscription.plan?.canUseFlexibleLicensing,
}

export const Addons = Template.bind({})
Addons.args = {
  subscription: annualActiveSubscriptionWithAddons,
  canUseFlexibleLicensing:
    annualActiveSubscriptionWithAddons.plan?.canUseFlexibleLicensing,
}

export const PendingPaused = Template.bind({})
PendingPaused.args = {
  subscription: pendingPausedSubscription,
  canUseFlexibleLicensing:
    pendingPausedSubscription.plan?.canUseFlexibleLicensing,
}

export const PendingPlanChange = Template.bind({})
PendingPlanChange.args = {
  subscription: pendingSubscriptionChange,
  canUseFlexibleLicensing:
    pendingSubscriptionChange.plan?.canUseFlexibleLicensing,
}

export const Coupons = Template.bind({})
Coupons.args = {
  subscription: annualActiveSubscriptionWithCoupons,
  canUseFlexibleLicensing:
    annualActiveSubscriptionWithCoupons.plan?.canUseFlexibleLicensing,
}
