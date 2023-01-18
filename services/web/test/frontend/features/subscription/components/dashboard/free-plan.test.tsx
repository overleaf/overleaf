import { render, screen } from '@testing-library/react'
import FreePlan from '../../../../../../frontend/js/features/subscription/components/dashboard/free-plan'

describe('<FreePlan />', function () {
  beforeEach(function () {
    window.metaAttributesCache = new Map()
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
  })

  it('renders free plan dash', function () {
    render(<FreePlan />)

    screen.getByText(
      'You are on the Overleaf Free plan. Upgrade to access these',
      {
        exact: false,
      }
    )

    screen.getByText('Upgrade Now')
  })
})
