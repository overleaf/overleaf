import { expect } from 'chai'
import { render, screen } from '@testing-library/react'
import SubscriptionDashboard from '../../../../../../frontend/js/features/subscription/components/dashboard/subscription-dashboard'

describe('<SubscriptionDashboard />', function () {
  beforeEach(function () {
    window.metaAttributesCache = new Map()
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
  })

  describe('Free Plan', function () {
    it('does not render the "Get the most out of your" subscription text', function () {
      render(<SubscriptionDashboard />)
      const text = screen.queryByText('Get the most out of your', {
        exact: false,
      })
      expect(text).to.be.null
    })
  })
})
