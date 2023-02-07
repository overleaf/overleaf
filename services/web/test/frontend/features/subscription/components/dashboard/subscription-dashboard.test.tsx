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
    it('does not render the "Get the most out of your" subscription text', function () {
      renderWithSubscriptionDashContext(<SubscriptionDashboard />)
      const text = screen.queryByText('Get the most out of your', {
        exact: false,
      })
      expect(text).to.be.null
    })
  })
})
