import { expect } from 'chai'
import { render, screen } from '@testing-library/react'
import PersonalSubscription from '../../../../../../frontend/js/features/subscription/components/dashboard/personal-subscription'
import { SubscriptionDashboardProvider } from '../../../../../../frontend/js/features/subscription/context/subscription-dashboard-context'
import {
  annualActiveSubscription,
  canceledSubscription,
  pastDueExpiredSubscription,
} from '../../fixtures/subscriptions'

describe('<PersonalSubscription />', function () {
  beforeEach(function () {
    window.metaAttributesCache = new Map()
    window.recurly = {}
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    delete window.recurly
  })

  describe('no subscription', function () {
    it('returns empty container', function () {
      const { container } = render(
        <SubscriptionDashboardProvider>
          <PersonalSubscription subscription={undefined} />
        </SubscriptionDashboardProvider>
      )
      expect(container.firstChild).to.be.null
    })
  })

  describe('subscription states  ', function () {
    it('renders the active dash', function () {
      render(
        <SubscriptionDashboardProvider>
          <PersonalSubscription subscription={annualActiveSubscription} />
        </SubscriptionDashboardProvider>
      )

      screen.getByText('You are currently subscribed to the', { exact: false })
    })

    it('renders the canceled dash', function () {
      render(
        <SubscriptionDashboardProvider>
          <PersonalSubscription subscription={canceledSubscription} />
        </SubscriptionDashboardProvider>
      )
      screen.getByText(
        'Your subscription has been canceled and will terminate on',
        { exact: false }
      )
      screen.getByText(canceledSubscription.recurly.nextPaymentDueAt, {
        exact: false,
      })

      screen.getByText('No further payments will be taken.', { exact: false })

      screen.getByText(
        'Get the most out of your Overleaf subscription by checking out the list of',
        { exact: false }
      )

      screen.getByRole('link', { name: 'View Your Invoices' })
      screen.getByRole('button', { name: 'Reactivate your subscription' })
    })

    it('renders the expired dash', function () {
      render(
        <SubscriptionDashboardProvider>
          <PersonalSubscription subscription={pastDueExpiredSubscription} />
        </SubscriptionDashboardProvider>
      )
      screen.getByText('Your subscription has expired.')
    })

    it('renders error message when an unknown subscription state', function () {
      const withStateDeleted = Object.assign(
        {},
        JSON.parse(JSON.stringify(annualActiveSubscription))
      )
      withStateDeleted.recurly.state = undefined
      render(
        <SubscriptionDashboardProvider>
          <PersonalSubscription subscription={withStateDeleted} />
        </SubscriptionDashboardProvider>
      )
      screen.getByText(
        'There is a problem with your subscription. Please contact us for more information.'
      )
    })
  })

  describe('past due subscription', function () {
    it('renders error alert', function () {
      render(
        <SubscriptionDashboardProvider>
          <PersonalSubscription subscription={pastDueExpiredSubscription} />
        </SubscriptionDashboardProvider>
      )
      screen.getByRole('alert')
      screen.getByText(
        'Your account currently has a past due invoice. You will not be able to change your plan until this is resolved.',
        { exact: false }
      )
      const invoiceLinks = screen.getAllByText('View Your Invoices', {
        exact: false,
      })
      expect(invoiceLinks.length).to.equal(2)
    })
  })

  describe('Recurly JS', function () {
    const recurlyFailedToLoadText =
      'Sorry, there was an error talking to our payment provider. Please try again in a few moments. If you are using any ad or script blocking extensions in your browser, you may need to temporarily disable them.'

    it('shows an alert and hides "Change plan" option when Recurly did not load', function () {
      delete window.recurly
      render(
        <SubscriptionDashboardProvider>
          <PersonalSubscription subscription={annualActiveSubscription} />
        </SubscriptionDashboardProvider>
      )

      screen.getByRole('alert')
      screen.getByText(recurlyFailedToLoadText)

      expect(screen.queryByText('Change plan')).to.be.null
    })

    it('should not show an alert and should show "Change plan" option when Recurly did load', function () {
      render(
        <SubscriptionDashboardProvider>
          <PersonalSubscription subscription={annualActiveSubscription} />
        </SubscriptionDashboardProvider>
      )

      expect(screen.queryByRole('alert')).to.be.null

      screen.getByText('Change plan')
    })
  })
})
