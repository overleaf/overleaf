import { expect } from 'chai'
import { fireEvent, render, screen } from '@testing-library/react'
import { SubscriptionDashboardProvider } from '../../../../../../../../../frontend/js/features/subscription/context/subscription-dashboard-context'
import { ChangePlan } from '../../../../../../../../../frontend/js/features/subscription/components/dashboard/states/active/change-plan/change-plan'
import { plans } from '../../../../../fixtures/plans'
import {
  annualActiveSubscription,
  pendingSubscriptionChange,
} from '../../../../../fixtures/subscriptions'
import { ActiveSubscription } from '../../../../../../../../../frontend/js/features/subscription/components/dashboard/states/active/active'

describe('<ChangePlan />', function () {
  beforeEach(function () {
    window.metaAttributesCache = new Map()
    window.metaAttributesCache.set('ol-plans', plans)
    // @ts-ignore
    window.recurly = {}
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    // @ts-ignore
    delete window.recurly
  })

  it('does not render the UI when showChangePersonalPlan is false', function () {
    window.metaAttributesCache.delete('ol-plans')
    const { container } = render(
      <SubscriptionDashboardProvider>
        <ChangePlan />
      </SubscriptionDashboardProvider>
    )

    expect(container.firstChild).to.be.null
  })

  it('renders the individual plans table', function () {
    window.metaAttributesCache.set('ol-subscription', annualActiveSubscription)
    render(
      <SubscriptionDashboardProvider>
        <ActiveSubscription subscription={annualActiveSubscription} />
      </SubscriptionDashboardProvider>
    )

    const button = screen.getByRole('button', { name: 'Change plan' })
    fireEvent.click(button)

    const changeToPlanButtons = screen.queryAllByRole('button', {
      name: 'Change to this plan',
    })
    expect(changeToPlanButtons.length).to.equal(plans.length - 1)
    screen.getByText('Your plan')

    const annualPlans = plans.filter(plan => plan.annual)
    expect(screen.getAllByText('/ year').length).to.equal(annualPlans.length)
    expect(screen.getAllByText('/ month').length).to.equal(
      plans.length - annualPlans.length
    )
  })

  it('renders the change to group plan UI', function () {
    window.metaAttributesCache.set('ol-subscription', annualActiveSubscription)
    render(
      <SubscriptionDashboardProvider>
        <ActiveSubscription subscription={annualActiveSubscription} />
      </SubscriptionDashboardProvider>
    )

    const button = screen.getByRole('button', { name: 'Change plan' })
    fireEvent.click(button)

    screen.getByText('Looking for multiple licenses?')
  })

  it('renders "Your new plan" and "Keep current plan" when there is a pending plan change', function () {
    window.metaAttributesCache.set('ol-subscription', pendingSubscriptionChange)
    render(
      <SubscriptionDashboardProvider>
        <ActiveSubscription subscription={pendingSubscriptionChange} />
      </SubscriptionDashboardProvider>
    )

    const button = screen.getByRole('button', { name: 'Change plan' })
    fireEvent.click(button)

    screen.getByText('Your new plan')
    screen.getByRole('button', { name: 'Keep my current plan' })
  })

  it('does not render when Recurly did not load', function () {
    // @ts-ignore
    delete window.recurly
    const { container } = render(
      <SubscriptionDashboardProvider>
        <ActiveSubscription subscription={annualActiveSubscription} />
      </SubscriptionDashboardProvider>
    )
    expect(container).not.to.be.null
  })
})
