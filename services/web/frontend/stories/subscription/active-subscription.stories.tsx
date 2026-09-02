import { cloneDeep } from 'lodash'
import { ActiveSubscription } from '@/features/subscription/components/dashboard/states/active/active'
import { CancelSubscription } from '@/features/subscription/components/dashboard/states/active/cancel-plan/cancel-subscription'
import {
  annualActiveSubscription,
  annualActiveSubscriptionWithCoupons,
  groupActiveSubscription,
  groupActiveSubscriptionWithPendingLicenseChange,
  groupProfessionalActiveSubscription,
  monthlyActiveCollaborator,
  pendingSubscriptionChange,
  trialCollaboratorSubscription,
} from '../../../test/frontend/features/subscription/fixtures/subscriptions'
import {
  groupPlans,
  plans,
} from '../../../test/frontend/features/subscription/fixtures/plans'
import { PaidSubscription } from '@ol-types/subscription/dashboard/subscription'
import { SubscriptionDashboardProvider } from '@/features/subscription/context/subscription-dashboard-context'
import preview from '@ol-storybook/preview'
import { withSplitTests } from '../../../.storybook/utils/with-split-tests'
import { setupSubscriptionDashContext } from '../../../test/frontend/features/subscription/helpers/setup-subscription-dash-context'

const PLAN_OVERRIDES = {
  pro: {
    monthly: { planCode: 'professional', name: 'Pro monthly' },
    annual: { planCode: 'professional-annual', name: 'Pro annual' },
  },
  student: {
    monthly: { planCode: 'student', name: 'Student' },
    annual: { planCode: 'student-annual', name: 'Student annual' },
  },
}

type Args = {
  group: boolean
  plan: 'standard' | 'pro' | 'student'
  period: 'monthly' | 'annual'
  currency: 'USD' | 'EUR'
  trial: boolean
  status: 'active' | 'past due' | 'pending pause' | 'paused'
  pendingPlanChange: boolean
  addOns: boolean
  coupons: boolean
  pendingLicenseChange: boolean
  'cancel-loss-messaging'?: 'default' | 'enabled'
}

// Build the subscription from orthogonal controls. Group subscriptions come
// from their own fixtures and ignore the individual-only args (which the
// argTypes `if` conditions hide from the controls panel).
function buildSubscription(args: Args): PaidSubscription {
  if (args.group) {
    if (args.pendingLicenseChange) {
      return groupActiveSubscriptionWithPendingLicenseChange as PaidSubscription
    }
    // there are no student group plans; anything but pro maps to Standard
    return (
      args.plan === 'pro'
        ? groupProfessionalActiveSubscription
        : groupActiveSubscription
    ) as PaidSubscription
  }

  const subscription = cloneDeep(
    args.period === 'monthly'
      ? monthlyActiveCollaborator
      : annualActiveSubscription
  )

  if (args.plan !== 'standard') {
    Object.assign(subscription.plan, PLAN_OVERRIDES[args.plan][args.period])
    subscription.planCode = subscription.plan.planCode
  }

  if (args.currency === 'EUR') {
    const { payment } = subscription
    Object.assign(payment, {
      currency: 'EUR',
      taxRate: 0.24,
      displayPrice: payment.displayPrice.replace('$', '€'),
      planOnlyDisplayPrice: payment.planOnlyDisplayPrice.replace('$', '€'),
    })
  }

  if (args.trial) {
    subscription.planCode += '_free_trial_7_days'
    subscription.plan.planCode = subscription.planCode
    subscription.payment.trialEndsAt =
      trialCollaboratorSubscription.payment.trialEndsAt
  }

  if (args.status === 'past due') {
    subscription.payment.state = 'past_due'
    subscription.payment.hasPastDueInvoice = true
  } else if (args.status === 'pending pause') {
    subscription.payment.remainingPauseCycles = 1
  } else if (args.status === 'paused') {
    subscription.payment.state = 'paused'
    subscription.payment.remainingPauseCycles = 1
  }

  if (args.pendingPlanChange) {
    // pick a pending plan that differs from the current one
    subscription.pendingPlan =
      args.plan === 'pro'
        ? {
            ...pendingSubscriptionChange.pendingPlan!,
            planCode: 'collaborator-annual',
            name: 'Standard annual',
          }
        : pendingSubscriptionChange.pendingPlan
  }

  if (args.addOns) {
    subscription.addOns = [
      { addOnCode: 'assistant', quantity: 1, unitAmountInCents: 10000 },
    ]
    subscription.payment.addOnDisplayPricesWithoutAdditionalLicense = {
      assistant: '$100.00',
    }
  }

  if (args.coupons) {
    subscription.payment.activeCoupons =
      annualActiveSubscriptionWithCoupons.payment.activeCoupons
  }

  return subscription
}

function setupDashboard(args: Args) {
  const subscription = buildSubscription(args)
  window.metaAttributesCache = window.metaAttributesCache || new Map()
  // @ts-ignore
  delete global.recurly
  setupSubscriptionDashContext({
    metaTags: [
      { name: 'ol-subscription', value: subscription },
      { name: 'ol-plans', value: plans },
      { name: 'ol-groupPlans', value: groupPlans },
      {
        name: 'ol-canUseFlexibleLicensing',
        value: subscription.plan?.canUseFlexibleLicensing ?? false,
      },
    ],
    currencyCode: subscription.payment.currency,
    recurlyNotLoaded: false,
    queryingRecurly: false,
  })
  return subscription
}

// Spread into the meta literal below: Storybook's static CSF indexer requires
// preview.meta() to receive an object literal, not a wrapping call expression
const splitTests = withSplitTests({}, ['cancel-loss-messaging'])

const individualOnly = { if: { arg: 'group', truthy: false } }

const meta = preview.meta({
  title: 'Subscription / ActiveSubscription',
  argTypes: {
    ...splitTests.argTypes,
    group: { control: 'boolean' },
    plan: {
      control: 'radio',
      options: ['standard', 'pro', 'student'],
      description: 'Groups have no student plans; student maps to Standard',
    },
    period: {
      control: 'radio',
      options: ['monthly', 'annual'],
      ...individualOnly,
    },
    currency: {
      control: 'radio',
      options: ['USD', 'EUR'],
      ...individualOnly,
    },
    trial: { control: 'boolean', ...individualOnly },
    status: {
      control: 'select',
      options: ['active', 'past due', 'pending pause', 'paused'],
      ...individualOnly,
    },
    pendingPlanChange: { control: 'boolean', ...individualOnly },
    addOns: { control: 'boolean', ...individualOnly },
    coupons: { control: 'boolean', ...individualOnly },
    pendingLicenseChange: { control: 'boolean', if: { arg: 'group' } },
  },
  decorators: [
    ...splitTests.decorators,
    Story => (
      <div id="subscription-dashboard-root">
        <Story />
      </div>
    ),
  ],
  args: {
    group: false,
    plan: 'standard',
    period: 'annual',
    currency: 'USD',
    trial: false,
    status: 'active',
    pendingPlanChange: false,
    addOns: false,
    coupons: false,
    pendingLicenseChange: false,
  } as Args,
  render: (args: Args) => {
    const subscription = setupDashboard(args)
    return (
      <SubscriptionDashboardProvider>
        <ActiveSubscription subscription={subscription} />
      </SubscriptionDashboardProvider>
    )
  },
})

export const Dashboard = meta.story({})

// The confirmation step reached via "Cancel your subscription", rendered
// directly. Switch the cancel-loss-messaging control between the default
// confirmation and the split test variant.
export const CancelConfirmation = meta.story({
  args: {
    'cancel-loss-messaging': 'enabled',
  },
  render: (args: Args) => {
    setupDashboard(args)
    return (
      <SubscriptionDashboardProvider>
        <CancelSubscription />
      </SubscriptionDashboardProvider>
    )
  },
})
