import { expect } from 'chai'
import sinon from 'sinon'
import { screen, fireEvent, render } from '@testing-library/react'
import { IntegrationLinkingWidget } from '../../../../../../frontend/js/features/settings/components/linking/integration-widget'
import * as eventTracking from '@/infrastructure/event-tracking'

describe('<IntegrationLinkingWidgetTest/>', function () {
  const defaultProps = {
    logo: <div />,
    title: 'Integration',
    description: 'paragraph1',
    helpPath: '/learn',
    linkPath: '/link',
    unlinkPath: '/unlink',
    unlinkConfirmationTitle: 'confirm unlink',
    unlinkConfirmationText: 'you will be unlinked',
  }

  describe('when the feature is not available', function () {
    let sendMBSpy: sinon.SinonSpy
    beforeEach(function () {
      sendMBSpy = sinon.spy(eventTracking, 'sendMB')
      render(<IntegrationLinkingWidget {...defaultProps} hasFeature={false} />)
    })

    afterEach(function () {
      sendMBSpy.restore()
    })

    it("should render 'Premium feature' label", function () {
      screen.getByText('Premium feature')
    })

    it('should render an upgrade link and track clicks', function () {
      const upgradeLink = screen.getByRole('link', { name: 'Upgrade' })
      expect(upgradeLink.getAttribute('href')).to.equal(
        '/user/subscription/plans'
      )
      fireEvent.click(upgradeLink)
      expect(sendMBSpy).to.be.calledOnce
      expect(sendMBSpy).calledWith('settings-upgrade-click')
    })
  })

  describe('when the integration is not linked', function () {
    beforeEach(function () {
      render(
        <IntegrationLinkingWidget {...defaultProps} hasFeature linked={false} />
      )
    })

    it('should render a link to initiate integration linking', function () {
      expect(
        screen.getByRole('link', { name: 'Link' }).getAttribute('href')
      ).to.equal('/link')
    })

    it("should not render 'premium feature' labels", function () {
      expect(screen.queryByText('premium_feature')).to.not.exist
      expect(screen.queryByText('integration_is_a_premium_feature')).to.not
        .exist
    })
  })

  describe('when the integration is linked', function () {
    beforeEach(function () {
      render(
        <IntegrationLinkingWidget
          {...defaultProps}
          hasFeature
          linked
          statusIndicator={<div>status indicator</div>}
        />
      )
    })

    it('should render a status indicator', function () {
      screen.getByText('status indicator')
    })

    it("should not render 'premium feature' labels", function () {
      expect(screen.queryByText('premium_feature')).to.not.exist
      expect(screen.queryByText('integration_is_a_premium_feature')).to.not
        .exist
    })

    it('should display an `unlink` button', function () {
      screen.getByRole('button', { name: 'Unlink' })
    })

    it('should open a modal with a link to confirm integration unlinking', function () {
      fireEvent.click(screen.getByRole('button', { name: 'Unlink' }))
      screen.getByText('confirm unlink')
      screen.getByText('you will be unlinked')
      screen.getByRole('button', { name: 'Cancel' })
      screen.getByRole('button', { name: 'Unlink' })
    })

    it('should cancel unlinking when clicking "cancel" in the confirmation modal', async function () {
      fireEvent.click(screen.getByRole('button', { name: 'Unlink' }))
      screen.getByText('confirm unlink')
      const cancelBtn = screen.getByRole('button', {
        name: 'Cancel',
        hidden: false,
      })
      fireEvent.click(cancelBtn)
      await screen.findByRole('button', { name: 'Cancel', hidden: true })
    })
  })
})
