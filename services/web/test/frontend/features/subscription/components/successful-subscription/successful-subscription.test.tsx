import { expect } from 'chai'
import { screen, within } from '@testing-library/react'
import SuccessfulSubscription from '../../../../../../frontend/js/features/subscription/components/successful-subscription/successful-subscription'
import { renderWithSubscriptionDashContext } from '../../helpers/render-with-subscription-dash-context'
import { annualActiveSubscription } from '../../fixtures/subscriptions'
import { ExposedSettings } from '../../../../../../types/exposed-settings'
import { UserProvider } from '@/shared/context/user-context'

describe('successful subscription page', function () {
  it('renders the invoices link', function () {
    const adminEmail = 'foo@example.com'
    renderWithSubscriptionDashContext(
      <UserProvider>
        <SuccessfulSubscription />
      </UserProvider>,

      {
        metaTags: [
          {
            name: 'ol-ExposedSettings',
            value: {
              adminEmail,
            } as ExposedSettings,
          },
          { name: 'ol-subscription', value: annualActiveSubscription },
        ],
      }
    )

    screen.getByRole('heading', { name: /thanks for subscribing/i })
    const alert = screen.getByRole('alert')
    within(alert).getByText(/to modify your subscription go to/i)
    const manageSubscriptionLink = within(alert).getByRole('link', {
      name: /manage subscription/i,
    })
    expect(manageSubscriptionLink.getAttribute('href')).to.equal(
      '/user/subscription'
    )
    screen.getByText(
      `Thank you for subscribing to the ${annualActiveSubscription.plan.name} plan.`,
      { exact: false }
    )
    screen.getByText(
      /it’s support from people like yourself that allows .* to continue to grow and improve/i
    )
    expect(screen.getByText(/get the most out of your/i).textContent).to.match(
      /get the most out of your subscription by checking out Overleaf’s features/i
    )
    expect(
      screen
        .getByText(/if there is anything you ever/i)
        .textContent?.replace(/\xA0/g, ' ')
    ).to.equal(
      `If there is anything you ever need please feel free to contact us directly at ${adminEmail}.`
    )

    const contactLink = screen.getByRole('link', {
      name: adminEmail,
    })
    expect(contactLink.getAttribute('href')).to.equal(`mailto:${adminEmail}`)

    expect(
      screen.getByText(/if you would like to help us improve/i).textContent
    ).to.match(
      /if you would like to help us improve .*, please take a moment to fill out this survey/i
    )

    const surveyLink = screen.getByRole('link', {
      name: /this survey/i,
    })
    expect(surveyLink.getAttribute('href')).to.equal(
      'https://forms.gle/CdLNX9m6NLxkv1yr5'
    )

    const helpLink = screen.getByRole('link', {
      name: /Overleaf’s features/i,
    })
    expect(helpLink.getAttribute('href')).to.equal(
      '/learn/how-to/Overleaf_premium_features'
    )

    const backToYourProjectsLink = screen.getByRole('link', {
      name: /back to your projects/i,
    })
    expect(backToYourProjectsLink.getAttribute('href')).to.equal('/project')
  })
})
