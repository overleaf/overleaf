import { expect } from 'chai'
import sinon from 'sinon'
import { fireEvent, screen, within } from '@testing-library/react'
import * as eventTracking from '../../../../../../frontend/js/infrastructure/event-tracking'
import PremiumFeaturesLink from '../../../../../../frontend/js/features/subscription/components/dashboard/premium-features-link'
import * as useLocationModule from '../../../../../../frontend/js/shared/hooks/use-location'
import {
  cleanUpContext,
  renderWithSubscriptionDashContext,
} from '../../helpers/render-with-subscription-dash-context'
import { annualActiveSubscription } from '../../fixtures/subscriptions'

describe('<PremiumFeaturesLink />', function () {
  const originalLocation = window.location

  let sendMBSpy: sinon.SinonSpy

  const variants = [
    { name: 'default', link: '/learn/how-to/Overleaf_premium_features' },
    { name: 'new', link: '/about/features-overview' },
  ]

  beforeEach(function () {
    sendMBSpy = sinon.spy(eventTracking, 'sendMB')
    this.locationStub = sinon.stub(useLocationModule, 'useLocation').returns({
      assign: sinon.stub(),
      reload: sinon.stub(),
    })
  })

  afterEach(function () {
    sendMBSpy.restore()
    this.locationStub.restore()
    cleanUpContext()
  })

  describe('without an active valid subscription', function () {
    it('returns an empty container', function () {
      const { container } = renderWithSubscriptionDashContext(
        <PremiumFeaturesLink />
      )
      expect(container.firstChild).to.be.null
    })
  })

  for (const variant of variants) {
    describe(`${variant.name} variant`, function () {
      it('renders the premium features link and sends analytics event', function () {
        renderWithSubscriptionDashContext(<PremiumFeaturesLink />, {
          metaTags: [
            { name: 'ol-subscription', value: annualActiveSubscription },
            {
              name: 'ol-splitTestVariants',
              value: { 'features-page': variant.name },
            },
          ],
        })
        const premiumText = screen.getByText('Get the most out of your', {
          exact: false,
        })
        const link = within(premiumText).getByRole('link')

        fireEvent.click(link)

        expect(sendMBSpy).to.be.calledOnce
        expect(sendMBSpy).calledWith('features-page-link', {
          splitTest: 'features-page',
          splitTestVariant: variant.name,
          page: originalLocation.pathname,
        })
      })
    })
  }
})
