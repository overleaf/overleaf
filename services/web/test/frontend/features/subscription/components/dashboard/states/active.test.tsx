import { fireEvent, render, screen } from '@testing-library/react'
import { ActiveSubsciption } from '../../../../../../../frontend/js/features/subscription/components/dashboard/states/active'
import { SubscriptionDashboardProvider } from '../../../../../../../frontend/js/features/subscription/context/subscription-dashboard-context'
import { Subscription } from '../../../../../../../types/subscription/dashboard/subscription'
import {
  annualActiveSubscription,
  pendingSubscriptionChange,
} from '../../../fixtures/subscriptions'

describe('<ActiveSubscription />', function () {
  beforeEach(function () {
    window.metaAttributesCache = new Map()
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
  })

  function expectedInActiveSubscription(subscription: Subscription) {
    // sentence broken up by bolding
    screen.getByText('You are currently subscribed to the', { exact: false })
    screen.getByText(subscription.plan.name, { exact: false })

    screen.getByRole('button', { name: 'Change plan' })

    // sentence broken up by bolding
    screen.getByText('The next payment of', { exact: false })
    screen.getByText(annualActiveSubscription.recurly.displayPrice, {
      exact: false,
    })
    screen.getByText('will be collected on', { exact: false })
    screen.getByText(annualActiveSubscription.recurly.nextPaymentDueAt, {
      exact: false,
    })

    // sentence broken up by link
    screen.getByText(
      'Get the most out of your Overleaf subscription by checking out the list of',
      { exact: false }
    )

    screen.getByText(
      '* Prices may be subject to additional VAT, depending on your country.'
    )

    screen.getByRole('link', { name: 'Update Your Billing Details' })
    screen.getByRole('link', { name: 'View Your Invoices' })
  }

  it('renders the dash annual active subscription', function () {
    render(
      <SubscriptionDashboardProvider>
        <ActiveSubsciption subscription={annualActiveSubscription} />
      </SubscriptionDashboardProvider>
    )
    expectedInActiveSubscription(annualActiveSubscription)
  })

  it('shows change plan UI when button clicked', function () {
    render(
      <SubscriptionDashboardProvider>
        <ActiveSubsciption subscription={annualActiveSubscription} />
      </SubscriptionDashboardProvider>
    )

    const button = screen.getByRole('button', { name: 'Change plan' })
    fireEvent.click(button)

    // confirm main dash UI UI still shown
    expectedInActiveSubscription(annualActiveSubscription)

    // TODO: add change plan UI
    screen.getByText('change subscription placeholder', { exact: false })
  })

  it('notes when user is changing plan at end of current plan term', function () {
    render(
      <SubscriptionDashboardProvider>
        <ActiveSubsciption subscription={pendingSubscriptionChange} />
      </SubscriptionDashboardProvider>
    )

    expectedInActiveSubscription(pendingSubscriptionChange)

    screen.getByText('Your plan is changing to', { exact: false })

    screen.getByText(pendingSubscriptionChange.pendingPlan!.name)
    screen.getByText(' at the end of the current billing period', {
      exact: false,
    })
  })
})
