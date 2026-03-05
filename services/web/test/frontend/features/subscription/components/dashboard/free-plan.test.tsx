import { render, screen } from '@testing-library/react'
import FreePlan from '../../../../../../frontend/js/features/subscription/components/dashboard/free-plan'
import { SplitTestProvider } from '@/shared/context/split-test-context'

describe('<FreePlan />', function () {
  it('renders free plan dash', function () {
    render(
      <SplitTestProvider>
        <FreePlan />
      </SplitTestProvider>
    )

    screen.getByText(
      'You are on the Overleaf Free plan. Upgrade to access these',
      {
        exact: false,
      }
    )

    screen.getByText('Upgrade now')
  })
})
