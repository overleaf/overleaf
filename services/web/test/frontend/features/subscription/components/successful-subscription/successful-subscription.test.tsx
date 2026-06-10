import { expect } from 'chai'
import { screen, within } from '@testing-library/react'
import SuccessfulSubscription from '../../../../../../frontend/js/features/subscription/components/successful-subscription/successful-subscription'
import { renderWithSubscriptionDashContext } from '../../helpers/render-with-subscription-dash-context'
import {
  annualActiveSubscription,
  annualActiveSubscriptionEuro,
  annualActiveSubscriptionPro,
} from '../../fixtures/subscriptions'
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

  describe('upgrade variant', function () {
    it('renders the upgrade success page when isUpgrade is true', function () {
      renderWithSubscriptionDashContext(
        <UserProvider>
          <SuccessfulSubscription />
        </UserProvider>,
        {
          metaTags: [
            {
              name: 'ol-ExposedSettings',
              value: {
                adminEmail: 'foo@example.com',
              } as ExposedSettings,
            },
            { name: 'ol-subscription', value: annualActiveSubscriptionPro },
            { name: 'ol-isUpgrade', value: true },
          ],
        }
      )

      screen.getByRole('heading', { name: /welcome to pro/i })
      const alert = screen.getByRole('alert')
      within(alert).getByText(/you.ve upgraded your subscription/i)
      const manageLink = within(alert).getByRole('link', {
        name: /manage subscription/i,
      })
      expect(manageLink.getAttribute('href')).to.equal('/user/subscription')

      expect(
        screen
          .getByText(/the next payment of/i)
          .textContent?.replace(/\xA0/g, ' ')
      ).to.equal(
        `The next payment of ${annualActiveSubscriptionPro.payment.displayPrice} will be collected on ${annualActiveSubscriptionPro.payment.nextPaymentDueAt}.`
      )
      screen.getByText(/taxes may be added, depending on your billing address/i)

      screen.getByText(/full access to every AI tool/i, { exact: false })

      const aiFeaturesLink = screen.getByRole('link', {
        name: /Overleaf.s AI features/i,
      })
      expect(aiFeaturesLink.getAttribute('href')).to.equal(
        'https://docs.overleaf.com/integrations-and-add-ons/ai-features'
      )
      expect(aiFeaturesLink.getAttribute('target')).to.equal('_blank')
      expect(aiFeaturesLink.getAttribute('rel')).to.equal('noopener noreferrer')

      const backLink = screen.getByRole('link', {
        name: /back to your projects/i,
      })
      expect(backLink.getAttribute('href')).to.equal('/project')
    })

    it('renders the standard success page when isUpgrade is not set', function () {
      renderWithSubscriptionDashContext(
        <UserProvider>
          <SuccessfulSubscription />
        </UserProvider>,
        {
          metaTags: [
            {
              name: 'ol-ExposedSettings',
              value: {
                adminEmail: 'foo@example.com',
              } as ExposedSettings,
            },
            { name: 'ol-subscription', value: annualActiveSubscription },
          ],
        }
      )

      screen.getByRole('heading', { name: /thanks for subscribing/i })
    })

    it('hides tax disclaimer when tax is already included in the price', function () {
      renderWithSubscriptionDashContext(
        <UserProvider>
          <SuccessfulSubscription />
        </UserProvider>,
        {
          metaTags: [
            {
              name: 'ol-ExposedSettings',
              value: {
                adminEmail: 'foo@example.com',
              } as ExposedSettings,
            },
            { name: 'ol-subscription', value: annualActiveSubscriptionEuro },
            { name: 'ol-isUpgrade', value: true },
          ],
        }
      )

      expect(screen.queryByText(/taxes may be added/i)).to.be.null
    })
  })
})
