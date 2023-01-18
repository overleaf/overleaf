import { expect } from 'chai'
import sinon from 'sinon'
import { fireEvent, render, screen, within } from '@testing-library/react'
import * as eventTracking from '../../../../../../frontend/js/infrastructure/event-tracking'
import PremiumFeaturesLink from '../../../../../../frontend/js/features/subscription/components/dashboard/premium-features-link'

describe('<PremiumFeaturesLink />', function () {
  const originalLocation = window.location

  let sendMBSpy: sinon.SinonSpy

  const variants = [
    { name: 'default', link: '/learn/how-to/Overleaf_premium_features' },
    { name: 'new', link: '/about/features-overview' },
  ]

  beforeEach(function () {
    window.metaAttributesCache = new Map()
    sendMBSpy = sinon.spy(eventTracking, 'sendMB')
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
    sendMBSpy.restore()
    Object.defineProperty(window, 'location', {
      value: originalLocation,
    })
  })

  for (const variant of variants) {
    describe(`${variant.name} variant`, function () {
      beforeEach(function () {
        window.metaAttributesCache.set('ol-splitTestVariants', {
          'features-page': variant.name,
        })
      })
      afterEach(function () {
        window.metaAttributesCache.delete('ol-splitTestVariants')
      })

      it('renders the premium features link and sends analytics event', function () {
        render(<PremiumFeaturesLink />)
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
