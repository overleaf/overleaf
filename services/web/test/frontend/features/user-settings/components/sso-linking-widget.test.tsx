import { expect } from 'chai'
import sinon from 'sinon'
import { screen, fireEvent, render, waitFor } from '@testing-library/react'
import { SSOLinkingWidget } from '../../../../../frontend/js/features/user-settings/components/sso-linking-widget'

describe('<SSOLinkingWidget />', function () {
  const defaultProps = {
    logoSrc: 'logo.png',
    title: 'integration',
    description: 'integration description',
    linkPath: 'integration/link',
    unlinkConfirmationTitle: 'confirm unlink',
    unlinkConfirmationText: 'you will be unlinked',
    onUnlink: () => Promise.resolve(),
  }

  it('should render', function () {
    render(<SSOLinkingWidget {...defaultProps} />)
    screen.getByText('integration')
    screen.getByText('integration description')
  })

  describe('when unlinked', function () {
    it('should render a link to `linkPath`', function () {
      render(<SSOLinkingWidget {...defaultProps} linked={false} />)
      expect(
        screen.getByRole('link', { name: 'link' }).getAttribute('href')
      ).to.equal('integration/link')
    })
  })

  describe('when linked', function () {
    let unlinkFunction

    beforeEach(function () {
      unlinkFunction = sinon.stub()
      render(
        <SSOLinkingWidget {...defaultProps} linked onUnlink={unlinkFunction} />
      )
    })

    it('should display an `unlink` button', function () {
      screen.getByRole('button', { name: 'Unlink' })
    })

    it('should open a modal to confirm integration unlinking', function () {
      fireEvent.click(screen.getByRole('button', { name: 'Unlink' }))
      screen.getByText('confirm unlink')
      screen.getByText('you will be unlinked')
    })

    it('should cancel unlinking when clicking cancel in the confirmation modal', async function () {
      fireEvent.click(screen.getByRole('button', { name: 'Unlink' }))
      screen.getByText('confirm unlink')
      const cancelBtn = screen.getByRole('button', {
        name: 'Cancel',
        hidden: false,
      })
      fireEvent.click(cancelBtn)
      await waitFor(() =>
        screen.getByRole('button', { name: 'Cancel', hidden: true })
      )
      expect(unlinkFunction).not.to.have.been.called
    })
  })

  describe('unlinking an account', function () {
    let confirmBtn, unlinkFunction

    beforeEach(function () {
      unlinkFunction = sinon.stub()
      render(
        <SSOLinkingWidget {...defaultProps} linked onUnlink={unlinkFunction} />
      )
      fireEvent.click(screen.getByRole('button', { name: 'Unlink' }))
      confirmBtn = screen.getByRole('button', {
        name: 'Unlink',
        hidden: false,
      })
    })

    it('should make an `unlink` request', function () {
      unlinkFunction.resolves()
      fireEvent.click(confirmBtn)
      expect(unlinkFunction).to.have.been.called
    })

    it('should display feedback while the request is inflight', async function () {
      unlinkFunction.returns(
        new Promise<void>(resolve => {
          setTimeout(resolve, 500)
        })
      )
      fireEvent.click(confirmBtn)
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Unlinking' }))
      )
    })
  })

  describe('when unlinking fails', function () {
    beforeEach(function () {
      const unlinkFunction = sinon.stub().rejects(new Error('unlinking failed'))
      render(
        <SSOLinkingWidget {...defaultProps} linked onUnlink={unlinkFunction} />
      )
      fireEvent.click(screen.getByRole('button', { name: 'Unlink' }))
      const confirmBtn = screen.getByRole('button', {
        name: 'Unlink',
        hidden: false,
      })
      fireEvent.click(confirmBtn)
    })

    it('should display an error message ', async function () {
      await waitFor(() => screen.getByText('unlinking failed'))
    })

    it('should display the unlink button ', async function () {
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Unlink' }))
      )
    })
  })
})
