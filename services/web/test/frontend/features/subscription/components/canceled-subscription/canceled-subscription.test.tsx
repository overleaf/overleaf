import { expect } from 'chai'
import { render, screen, within } from '@testing-library/react'
import CanceledSubscription from '../../../../../../frontend/js/features/subscription/components/canceled-subscription/canceled'

describe('canceled subscription page', function () {
  it('renders the invoices link', function () {
    render(<CanceledSubscription />)

    screen.getByRole('heading', { name: /subscription canceled/i })
    const alert = screen.getByRole('alert')
    within(alert).getByText(/to modify your subscription go to/i)
    const manageSubscriptionLink = within(alert).getByRole('link', {
      name: /manage subscription/i,
    })
    expect(manageSubscriptionLink.getAttribute('href')).to.equal(
      '/user/subscription'
    )

    const backToYourProjectsLink = screen.getByRole('link', {
      name: /back to your projects/i,
    })
    expect(backToYourProjectsLink.getAttribute('href')).to.equal('/project')
  })
})
