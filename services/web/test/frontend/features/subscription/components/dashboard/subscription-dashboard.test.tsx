import { expect } from 'chai'
import { screen } from '@testing-library/react'
import SubscriptionDashboard from '../../../../../../frontend/js/features/subscription/components/dashboard/subscription-dashboard'
import {
  cleanUpContext,
  renderWithSubscriptionDashContext,
} from '../../helpers/render-with-subscription-dash-context'
import { groupPlans, plans } from '../../fixtures/plans'
import { annualActiveSubscription } from '../../fixtures/subscriptions'

describe('<SubscriptionDashboard />', function () {
  afterEach(function () {
    cleanUpContext()
  })

  describe('With an active subscription', function () {
    beforeEach(function () {
      renderWithSubscriptionDashContext(<SubscriptionDashboard />, {
        metaTags: [
          { name: 'ol-plans', value: plans },
          {
            name: 'ol-groupPlans',
            value: groupPlans,
          },
          { name: 'ol-subscription', value: annualActiveSubscription },
          {
            name: 'ol-recommendedCurrency',
            value: 'USD',
          },
        ],
      })
    })

    it('renders the "Get the most from your subscription" text', function () {
      screen.getByText(/Get the most out of your subscription/i)
    })
  })

  describe('Free Plan', function () {
    beforeEach(function () {
      renderWithSubscriptionDashContext(<SubscriptionDashboard />)
    })

    it('does not render the "Get the most out of your" subscription text', function () {
      const text = screen.queryByText('Get the most out of your subscription', {
        exact: false,
      })
      expect(text).to.be.null
    })

    it('does not render the contact Support message', function () {
      const text = screen.queryByText(
        `You’re on an Overleaf Paid plan. Contact`,
        {
          exact: false,
        }
      )
      expect(text).to.be.null
    })
  })

  describe('Custom subscription', function () {
    it('renders the contact Support message', function () {
      renderWithSubscriptionDashContext(<SubscriptionDashboard />, {
        metaTags: [
          {
            name: 'ol-currentInstitutionsWithLicence',
            value: [],
          },
          {
            name: 'ol-hasSubscription',
            value: true,
          },
        ],
      })

      screen.getByText(`You’re on an Overleaf Paid plan.`, {
        exact: false,
      })
      screen.getByText(`Contact Support`, {
        exact: false,
      })
    })
  })

  it('Show a warning when coming from plans page', function () {
    renderWithSubscriptionDashContext(<SubscriptionDashboard />, {
      metaTags: [
        {
          name: 'ol-fromPlansPage',
          value: true,
        },
      ],
    })

    screen.getByText('You already have a subscription')
  })
})
