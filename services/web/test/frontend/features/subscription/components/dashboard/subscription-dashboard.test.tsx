import { render, screen } from '@testing-library/react'
import SubscriptionDashboard from '../../../../../../frontend/js/features/subscription/components/dashboard/subscription-dashboard'

describe('<SubscriptionDashboard />', function () {
  beforeEach(function () {
    window.metaAttributesCache = new Map()
    window.metaAttributesCache.set('ol-currentInstitutionsWithLicence', [
      {
        id: 9258,
        name: 'Test University',
        commonsAccount: true,
        isUniversity: true,
        confirmed: true,
        ssoBeta: false,
        ssoEnabled: false,
        maxConfirmationMonths: 6,
      },
    ])
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
  })

  it('renders the premium features text when a user has a subscription', function () {
    render(<SubscriptionDashboard />)
    screen.getByText('Get the most out of your', { exact: false })
  })
})
