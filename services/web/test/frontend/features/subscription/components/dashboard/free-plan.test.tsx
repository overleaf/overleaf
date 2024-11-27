import { render, screen } from '@testing-library/react'
import FreePlan from '../../../../../../frontend/js/features/subscription/components/dashboard/free-plan'

describe('<FreePlan />', function () {
  it('renders free plan dash', function () {
    render(<FreePlan />)

    screen.getByText(
      'You are on the Overleaf Free plan. Upgrade to access these',
      {
        exact: false,
      }
    )

    screen.getByText('Upgrade now')
  })
})
