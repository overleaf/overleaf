import { expect } from 'chai'
import { screen } from '@testing-library/react'
import SubscriptionDashboard from '../../../../../../frontend/js/features/subscription/components/dashboard/subscription-dashboard'
import {
  cleanUpContext,
  renderWithSubscriptionDashContext,
} from '../../helpers/render-with-subscription-dash-context'

describe('<SubscriptionDashboard />', function () {
  afterEach(function () {
    cleanUpContext()
  })

  describe('Free Plan', function () {
    beforeEach(function () {
      renderWithSubscriptionDashContext(<SubscriptionDashboard />)
    })

    it('does not render the "Get the most out of your" subscription text', function () {
      const text = screen.queryByText('Get the most out of your', {
        exact: false,
      })
      expect(text).to.be.null
    })

    it('does not render the contact support message', function () {
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
    it('renders the contact support message', function () {
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
      screen.getByText(`Contact support`, {
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
