import { expect } from 'chai'
import sinon from 'sinon'
import { fireEvent, screen, render } from '@testing-library/react'
import { UserEmailsProvider } from '../../../../../frontend/js/features/settings/context/user-email-context'
import { LeaversSurveyAlert } from '../../../../../frontend/js/features/settings/components/leavers-survey-alert'
import * as eventTracking from '@/infrastructure/event-tracking'
import localStorage from '@/infrastructure/local-storage'
import fetchMock from 'fetch-mock'

function renderWithProvider() {
  render(<LeaversSurveyAlert />, {
    wrapper: ({ children }) => (
      <UserEmailsProvider>{children}</UserEmailsProvider>
    ),
  })
}

describe('<LeaversSurveyAlert/>', function () {
  beforeEach(function () {
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
  })

  afterEach(function () {
    fetchMock.reset()
  })

  it('should render before the expiration date', function () {
    const tomorrow = Date.now() + 1000 * 60 * 60 * 24
    localStorage.setItem('showInstitutionalLeaversSurveyUntil', tomorrow)
    localStorage.setItem('hideInstitutionalLeaversSurvey', false)
    renderWithProvider()
    screen.getByRole('alert')
    screen.getByText(/Provide some quick feedback/)
    screen.getByRole('link', { name: 'Take a short survey' })
  })

  it('should not render after the expiration date', function () {
    const yesterday = Date.now() - 1000 * 60 * 60 * 24
    localStorage.setItem('showInstitutionalLeaversSurveyUntil', yesterday)
    localStorage.setItem('hideInstitutionalLeaversSurvey', false)
    renderWithProvider()
    expect(screen.queryByRole('alert')).to.be.null
  })

  it('should not render if it has been hidden', function () {
    const tomorrow = Date.now() + 1000 * 60 * 60 * 24
    localStorage.setItem('showInstitutionalLeaversSurveyUntil', tomorrow)
    localStorage.setItem('hideInstitutionalLeaversSurvey', true)
    renderWithProvider()
    expect(screen.queryByRole('alert')).to.be.null
  })

  it('should reset the expiration date when it is closed', function () {
    const tomorrow = Date.now() + 1000 * 60 * 60 * 24
    localStorage.setItem('showInstitutionalLeaversSurveyUntil', tomorrow)
    localStorage.setItem('hideInstitutionalLeaversSurvey', false)
    renderWithProvider()
    screen.getByRole('alert')

    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByRole('alert')).to.be.null

    expect(localStorage.getItem('showInstitutionalLeaversSurveyUntil')).to.be
      .null
  })

  describe('event tracking', function () {
    let sendMBSpy: sinon.SinonSpy

    beforeEach(function () {
      sendMBSpy = sinon.spy(eventTracking, 'sendMB')
      const tomorrow = Date.now() + 1000 * 60 * 60 * 24
      localStorage.setItem('showInstitutionalLeaversSurveyUntil', tomorrow)
      localStorage.setItem('hideInstitutionalLeaversSurvey', false)
      renderWithProvider()
    })

    afterEach(function () {
      sendMBSpy.restore()
      localStorage.clear()
    })

    it('should sent a `view` event on load', function () {
      expect(sendMBSpy).to.be.calledOnce
      expect(sendMBSpy).calledWith(
        'institutional-leavers-survey-notification',
        { type: 'view', page: '/' }
      )
    })

    it('should sent a `click` event when the link is clicked', function () {
      fireEvent.click(screen.getByRole('link'))
      expect(sendMBSpy).to.be.calledTwice
      expect(sendMBSpy).calledWith(
        'institutional-leavers-survey-notification',
        { type: 'click', page: '/' }
      )
    })

    it('should sent a `close` event when it is closed', function () {
      fireEvent.click(screen.getByRole('button'))
      expect(sendMBSpy).to.be.calledTwice
      expect(sendMBSpy).calledWith(
        'institutional-leavers-survey-notification',
        { type: 'close', page: '/' }
      )
    })
  })
})
