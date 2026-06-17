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
      'You’re using our free plan. Upgrade to get the best Overleaf experience',
      {
        exact: false,
      }
    )

    screen.getByText('Upgrade now')
  })
})
