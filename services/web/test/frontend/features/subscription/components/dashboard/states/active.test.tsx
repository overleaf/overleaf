import { expect } from 'chai'
import { fireEvent, render, screen } from '@testing-library/react'
import * as eventTracking from '../../../../../../../frontend/js/infrastructure/event-tracking'
import { ActiveSubsciption } from '../../../../../../../frontend/js/features/subscription/components/dashboard/states/active/active'
import { SubscriptionDashboardProvider } from '../../../../../../../frontend/js/features/subscription/context/subscription-dashboard-context'
import { Subscription } from '../../../../../../../types/subscription/dashboard/subscription'
import {
  annualActiveSubscription,
  groupActiveSubscription,
  groupActiveSubscriptionWithPendingLicenseChange,
  pendingSubscriptionChange,
  trialSubscription,
} from '../../../fixtures/subscriptions'
import sinon from 'sinon'

describe('<ActiveSubscription />', function () {
  let sendMBSpy: sinon.SinonSpy

  beforeEach(function () {
    window.metaAttributesCache = new Map()
    sendMBSpy = sinon.spy(eventTracking, 'sendMB')
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    sendMBSpy.restore()
  })

  function expectedInActiveSubscription(subscription: Subscription) {
    // sentence broken up by bolding
    screen.getByText('You are currently subscribed to the', { exact: false })
    screen.getByText(subscription.plan.name, { exact: false })

    screen.getByRole('button', { name: 'Change plan' })

    // sentence broken up by bolding
    screen.getByText('The next payment of', { exact: false })
    screen.getByText(subscription.recurly.displayPrice, {
      exact: false,
    })
    screen.getByText('will be collected on', { exact: false })
    const dates = screen.getAllByText(subscription.recurly.nextPaymentDueAt, {
      exact: false,
    })
    expect(dates.length).to.equal(2)

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

  it('does not show "Change plan" option for group plans', function () {
    render(
      <SubscriptionDashboardProvider>
        <ActiveSubsciption subscription={groupActiveSubscription} />
      </SubscriptionDashboardProvider>
    )

    const changePlan = screen.queryByRole('button', { name: 'Change plan' })
    expect(changePlan).to.be.null
  })

  it('does not show "Change plan" option when past due', function () {
    // account is likely in expired state, but be sure to not show option if state is still active
    const activePastDueSubscription = Object.assign(
      {},
      annualActiveSubscription
    )

    activePastDueSubscription.recurly.account.has_past_due_invoice._ = 'true'

    render(
      <SubscriptionDashboardProvider>
        <ActiveSubsciption subscription={activePastDueSubscription} />
      </SubscriptionDashboardProvider>
    )

    const changePlan = screen.queryByRole('button', { name: 'Change plan' })
    expect(changePlan).to.be.null
  })

  it('shows the pending license change message when plan change is pending', function () {
    render(
      <SubscriptionDashboardProvider>
        <ActiveSubsciption
          subscription={groupActiveSubscriptionWithPendingLicenseChange}
        />
      </SubscriptionDashboardProvider>
    )

    screen.getByText('Your subscription is changing to include', {
      exact: false,
    })

    if (
      !groupActiveSubscriptionWithPendingLicenseChange.recurly
        .pendingAdditionalLicenses
    ) {
      throw Error('not expected test data')
    }
    screen.getByText(
      groupActiveSubscriptionWithPendingLicenseChange.recurly
        .pendingAdditionalLicenses
    )

    screen.getByText('additional license(s) for a total of', { exact: false })

    if (
      !groupActiveSubscriptionWithPendingLicenseChange.recurly
        .pendingTotalLicenses
    ) {
      throw Error('not expected test data')
    }
    screen.getByText(
      groupActiveSubscriptionWithPendingLicenseChange.recurly
        .pendingTotalLicenses
    )
  })

  it('shows the pending license change message when plan change is not pending', function () {
    const subscription = Object.assign({}, groupActiveSubscription)
    subscription.recurly.additionalLicenses = 4
    subscription.recurly.totalLicenses =
      subscription.recurly.totalLicenses +
      subscription.recurly.additionalLicenses

    render(
      <SubscriptionDashboardProvider>
        <ActiveSubsciption subscription={subscription} />
      </SubscriptionDashboardProvider>
    )

    screen.getByText('Your subscription includes', {
      exact: false,
    })

    if (!subscription.recurly.additionalLicenses) {
      throw Error('not expected test data')
    }
    screen.getByText(subscription.recurly.additionalLicenses)

    screen.getByText('additional license(s) for a total of', { exact: false })

    screen.getByText(subscription.recurly.totalLicenses)
  })

  it('shows when trial ends and first payment collected', function () {
    render(
      <SubscriptionDashboardProvider>
        <ActiveSubsciption subscription={trialSubscription} />
      </SubscriptionDashboardProvider>
    )
    screen.getByText('You’re on a free trial which ends on', { exact: false })
    if (!trialSubscription.recurly.trialEndsAtFormatted) {
      throw new Error('not expected test data')
    }
    const endDate = screen.getAllByText(
      trialSubscription.recurly.trialEndsAtFormatted
    )
    expect(endDate.length).to.equal(2)
  })

  it('shows cancel UI and sends event', function () {
    render(
      <SubscriptionDashboardProvider>
        <ActiveSubsciption subscription={annualActiveSubscription} />
      </SubscriptionDashboardProvider>
    )
    // before button clicked
    screen.getByText(
      'Your subscription will remain active until the end of your billing period',
      { exact: false }
    )
    const dates = screen.getAllByText(
      annualActiveSubscription.recurly.nextPaymentDueAt,
      {
        exact: false,
      }
    )
    expect(dates.length).to.equal(2)

    const button = screen.getByRole('button', {
      name: 'Cancel Your Subscription',
    })
    fireEvent.click(button)
    expect(sendMBSpy).to.be.calledOnceWith(
      'subscription-page-cancel-button-click'
    )

    screen.getByText('We’d love you to stay')
  })
})
