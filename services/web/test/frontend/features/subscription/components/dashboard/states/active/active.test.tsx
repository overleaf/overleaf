import { expect } from 'chai'
import { fireEvent, screen } from '@testing-library/react'
import * as eventTracking from '../../../../../../../../frontend/js/infrastructure/event-tracking'
import { ActiveSubscription } from '../../../../../../../../frontend/js/features/subscription/components/dashboard/states/active/active'
import { Subscription } from '../../../../../../../../types/subscription/dashboard/subscription'
import {
  annualActiveSubscription,
  groupActiveSubscription,
  groupActiveSubscriptionWithPendingLicenseChange,
  pendingSubscriptionChange,
  trialSubscription,
} from '../../../../fixtures/subscriptions'
import sinon from 'sinon'
import { plans } from '../../../../fixtures/plans'
import {
  cleanUpContext,
  renderWithSubscriptionDashContext,
} from '../../../../helpers/render-with-subscription-dash-context'

describe('<ActiveSubscription />', function () {
  let sendMBSpy: sinon.SinonSpy

  beforeEach(function () {
    sendMBSpy = sinon.spy(eventTracking, 'sendMB')
  })

  afterEach(function () {
    cleanUpContext()
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

  function renderActiveSubscription(subscription: Subscription) {
    const renderOptions = {
      metaTags: [
        { name: 'ol-plans', value: plans },
        { name: 'ol-subscription', value: subscription },
      ],
    }
    renderWithSubscriptionDashContext(
      <ActiveSubscription subscription={subscription} />,
      renderOptions
    )
  }

  it('renders the dash annual active subscription', function () {
    renderActiveSubscription(annualActiveSubscription)
    expectedInActiveSubscription(annualActiveSubscription)
  })

  it('shows change plan UI when button clicked', async function () {
    renderActiveSubscription(annualActiveSubscription)

    const button = screen.getByRole('button', { name: 'Change plan' })
    fireEvent.click(button)

    // confirm main dash UI still shown
    screen.getByText('You are currently subscribed to the', { exact: false })

    await screen.findByRole('heading', { name: 'Change plan' })
    expect(
      screen.getAllByRole('button', { name: 'Change to this plan' }).length > 0
    ).to.be.true
  })

  it('notes when user is changing plan at end of current plan term', function () {
    renderActiveSubscription(pendingSubscriptionChange)

    expectedInActiveSubscription(pendingSubscriptionChange)

    screen.getByText('Your plan is changing to', { exact: false })

    screen.getByText(pendingSubscriptionChange.pendingPlan!.name)
    screen.getByText(' at the end of the current billing period', {
      exact: false,
    })

    screen.getByText(
      'If you wish this change to apply before the end of your current billing period, please contact us.'
    )

    expect(screen.queryByRole('link', { name: 'contact support' })).to.be.null
    expect(screen.queryByText('if you wish to change your group subscription.'))
      .to.be.null
  })

  it('does not show "Change plan" option when past due', function () {
    // account is likely in expired state, but be sure to not show option if state is still active
    const activePastDueSubscription = Object.assign(
      {},
      JSON.parse(JSON.stringify(annualActiveSubscription))
    )

    activePastDueSubscription.recurly.account.has_past_due_invoice._ = 'true'

    renderActiveSubscription(activePastDueSubscription)

    const changePlan = screen.queryByRole('button', { name: 'Change plan' })
    expect(changePlan).to.be.null
  })

  it('shows the pending license change message when plan change is pending', function () {
    renderActiveSubscription(groupActiveSubscriptionWithPendingLicenseChange)

    screen.getByText('Your subscription is changing to include', {
      exact: false,
    })

    screen.getByText(
      groupActiveSubscriptionWithPendingLicenseChange.recurly
        .pendingAdditionalLicenses!
    )

    screen.getByText('additional license(s) for a total of', { exact: false })

    screen.getByText(
      groupActiveSubscriptionWithPendingLicenseChange.recurly
        .pendingTotalLicenses!
    )

    expect(
      screen.queryByText(
        'If you wish this change to apply before the end of your current billing period, please contact us.'
      )
    ).to.be.null
  })

  it('shows the pending license change message when plan change is not pending', function () {
    const subscription = Object.assign({}, groupActiveSubscription)
    subscription.recurly.additionalLicenses = 4
    subscription.recurly.totalLicenses =
      subscription.recurly.totalLicenses +
      subscription.recurly.additionalLicenses

    renderActiveSubscription(subscription)

    screen.getByText('Your subscription includes', {
      exact: false,
    })

    screen.getByText(subscription.recurly.additionalLicenses)

    screen.getByText('additional license(s) for a total of', { exact: false })

    screen.getByText(subscription.recurly.totalLicenses)
  })

  it('shows when trial ends and first payment collected', function () {
    renderActiveSubscription(trialSubscription)
    screen.getByText('You’re on a free trial which ends on', { exact: false })

    const endDate = screen.getAllByText(
      trialSubscription.recurly.trialEndsAtFormatted!
    )
    expect(endDate.length).to.equal(2)
  })

  it('shows cancel UI and sends event', function () {
    renderActiveSubscription(annualActiveSubscription)
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

  describe('group plans', function () {
    it('does not show "Change plan" option for group plans', function () {
      renderActiveSubscription(groupActiveSubscription)

      const changePlan = screen.queryByRole('button', { name: 'Change plan' })
      expect(changePlan).to.be.null
    })

    it('shows contact support message for group plan change requests', function () {
      renderActiveSubscription(groupActiveSubscription)
      screen.getByRole('link', { name: 'contact support' })
      screen.getByText('if you wish to change your group subscription.', {
        exact: false,
      })
    })
  })
})
