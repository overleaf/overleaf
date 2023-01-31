import { render, screen } from '@testing-library/react'
import { ExpiredSubscription } from '../../../../../../../frontend/js/features/subscription/components/dashboard/states/expired'
import { pastDueExpiredSubscription } from '../../../fixtures/subscriptions'

describe('<ExpiredSubscription />', function () {
  beforeEach(function () {
    window.metaAttributesCache = new Map()
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
  })

  it('renders the invoices link', function () {
    render(<ExpiredSubscription subscription={pastDueExpiredSubscription} />)

    screen.getByText('View Your Invoices', {
      exact: false,
    })
  })
})
