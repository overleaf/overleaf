import {
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from '@testing-library/react'
import sinon from 'sinon'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { cloneDeep } from 'lodash'
import ReconfirmationInfo from '../../../../../../frontend/js/features/settings/components/emails/reconfirmation-info'
import { ssoUserData } from '../../fixtures/test-user-email-data'
import { UserEmailData } from '../../../../../../types/user-email'
import { UserEmailsProvider } from '../../../../../../frontend/js/features/settings/context/user-email-context'

function renderReconfirmationInfo(data: UserEmailData) {
  return render(
    <UserEmailsProvider>
      <ReconfirmationInfo userEmailData={data} />
    </UserEmailsProvider>
  )
}

describe('<ReconfirmationInfo/>', function () {
  beforeEach(function () {
    window.metaAttributesCache = window.metaAttributesCache || new Map()
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
  })

  afterEach(function () {
    fetchMock.reset()
  })

  describe('reconfirmed via SAML', function () {
    beforeEach(function () {
      window.metaAttributesCache.set(
        'ol-reconfirmedViaSAML',
        'sso-prof-saml-id'
      )
    })

    afterEach(function () {
      window.metaAttributesCache = new Map()
    })

    it('show reconfirmed confirmation', function () {
      renderReconfirmationInfo(ssoUserData)
      screen.getByText('SSO University')
      screen.getByText(/affiliation is confirmed/)
      screen.getByText(/Thank you!/)
    })
  })

  describe('in reconfirm notification period', function () {
    let inReconfirmUserData: UserEmailData
    const locationStub = sinon.stub()
    const originalLocation = window.location

    beforeEach(function () {
      window.metaAttributesCache.set('ol-ExposedSettings', {
        samlInitPath: '/saml',
      })
      Object.defineProperty(window, 'location', {
        value: {
          assign: locationStub,
        },
      })

      inReconfirmUserData = cloneDeep(ssoUserData)
      if (inReconfirmUserData.affiliation) {
        inReconfirmUserData.affiliation.inReconfirmNotificationPeriod = true
      }
    })

    afterEach(function () {
      window.metaAttributesCache = new Map()
      Object.defineProperty(window, 'location', {
        value: originalLocation,
      })
    })

    it('renders prompt', function () {
      renderReconfirmationInfo(inReconfirmUserData)
      screen.getByText(/Are you still at/)
      screen.getByText('SSO University')
      screen.getByText(
        /Please take a moment to confirm your institutional email address/
      )
      screen.getByRole('link', { name: 'Learn more' })
      expect(screen.queryByText(/add a new primary email address/)).to.not.exist
    })

    it('renders default emails prompt', function () {
      inReconfirmUserData.default = true
      renderReconfirmationInfo(inReconfirmUserData)
      screen.getByText(/add a new primary email address/)
    })

    describe('SAML reconfirmations', function () {
      beforeEach(function () {
        window.metaAttributesCache.set('ol-ExposedSettings', {
          hasSamlFeature: true,
          samlInitPath: '/saml/init',
        })
      })

      it('redirects to SAML flow', async function () {
        renderReconfirmationInfo(inReconfirmUserData)
        const confirmButton = screen.getByRole('button', {
          name: 'Confirm Affiliation',
        }) as HTMLButtonElement

        await waitFor(() => {
          expect(confirmButton.disabled).to.be.false
        })
        fireEvent.click(confirmButton)

        await waitFor(() => {
          expect(confirmButton.disabled).to.be.true
        })
        sinon.assert.calledOnce(locationStub)
        sinon.assert.calledWithMatch(
          locationStub,
          '/saml/init?university_id=2&reconfirm=/user/settings'
        )
      })
    })

    describe('Email reconfirmations', function () {
      beforeEach(function () {
        window.metaAttributesCache.set('ol-ExposedSettings', {
          hasSamlFeature: false,
        })
        fetchMock.post('/user/emails/resend_confirmation', 200)
      })

      it('sends and resends confirmation email', async function () {
        renderReconfirmationInfo(inReconfirmUserData)
        const confirmButton = screen.getByRole('button', {
          name: 'Confirm Affiliation',
        }) as HTMLButtonElement

        await waitFor(() => {
          expect(confirmButton.disabled).to.be.false
        })
        fireEvent.click(confirmButton)

        await waitFor(() => {
          expect(confirmButton.disabled).to.be.true
        })
        expect(fetchMock.called()).to.be.true

        // the confirmation text should now be displayed
        screen.getByText(/Please check your email inbox to confirm/)

        // try the resend button
        fetchMock.resetHistory()
        const resendButton = screen.getByRole('button', {
          name: 'Resend confirmation email',
        }) as HTMLButtonElement

        fireEvent.click(resendButton)

        screen.getByText(/Sending/)
        expect(fetchMock.called()).to.be.true
        await waitForElementToBeRemoved(() => screen.getByText(/Sending/))
        screen.getByRole('button', {
          name: 'Resend confirmation email',
        })
      })
    })
  })
})
