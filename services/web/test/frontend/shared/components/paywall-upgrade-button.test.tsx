import { expect } from 'chai'
import sinon from 'sinon'
import { screen, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PaywallUpgradeButton from '../../../../frontend/js/shared/components/paywall-upgrade-button'
import * as eventTracking from '@/infrastructure/event-tracking'

describe('<PaywallUpgradeButton />', function () {
  let sendMBSpy: sinon.SinonSpy

  beforeEach(function () {
    sendMBSpy = sinon.spy(eventTracking, 'sendMB')
    window.metaAttributesCache.set('ol-user', { hasPaidSubscription: false })
  })

  afterEach(function () {
    sendMBSpy.restore()
  })

  it('upgrade link has required attributes', function () {
    render(<PaywallUpgradeButton referrer="ai" paywallType="assistant" />)

    const upgradeLink = screen.getByRole('link', { name: 'Upgrade' })
    expect(upgradeLink.getAttribute('href')).to.equal(
      '/user/subscription/choose-your-plan?itm_referrer=ai&itm_campaign=assistant&paywall-type=assistant'
    )
    expect(upgradeLink.getAttribute('target')).to.equal('_blank')
    expect(upgradeLink.getAttribute('rel')).to.equal('noreferrer')
  })

  it('sends paywall-click with standalone upgradeType for users without a paid subscription', async function () {
    render(<PaywallUpgradeButton referrer="ai" paywallType="assistant" />)

    await userEvent.click(screen.getByRole('link', { name: 'Upgrade' }))

    expect(sendMBSpy).to.have.been.calledOnceWith(
      'paywall-click',
      sinon.match({
        upgradeType: 'standalone',
        'paywall-type': 'assistant',
      })
    )
  })

  it('sends paywall-click with add-on upgradeType for users with a paid subscription', async function () {
    window.metaAttributesCache.set('ol-user', { hasPaidSubscription: true })

    render(<PaywallUpgradeButton referrer="ai" paywallType="workbench" />)

    await userEvent.click(screen.getByRole('link', { name: 'Upgrade' }))

    expect(sendMBSpy).to.have.been.calledOnceWith(
      'paywall-click',
      sinon.match({
        upgradeType: 'add-on',
        'paywall-type': 'workbench',
      })
    )
  })
})
