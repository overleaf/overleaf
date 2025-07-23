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
import { location } from '@/shared/components/location'
import getMeta from '@/utils/meta'

function renderReconfirmationInfo(data: UserEmailData) {
  return render(
    <UserEmailsProvider>
      <ReconfirmationInfo userEmailData={data} />
    </UserEmailsProvider>
  )
}

describe('<ReconfirmationInfo/>', function () {
  beforeEach(function () {
    Object.assign(getMeta('ol-ExposedSettings'), {
      samlInitPath: '/saml',
    })
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
    this.locationWrapperSandbox = sinon.createSandbox()
    this.locationWrapperStub = this.locationWrapperSandbox.stub(location)
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
    this.locationWrapperSandbox.restore()
  })

  describe('reconfirmed via SAML', function () {
    beforeEach(function () {
      window.metaAttributesCache.set(
        'ol-reconfirmedViaSAML',
        'sso-prof-saml-id'
      )
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

    beforeEach(function () {
      Object.assign(getMeta('ol-ExposedSettings'), {
        samlInitPath: '/saml',
      })

      inReconfirmUserData = cloneDeep(ssoUserData)
      if (inReconfirmUserData.affiliation) {
        inReconfirmUserData.affiliation.inReconfirmNotificationPeriod = true
      }
    })

    it('renders prompt', function () {
      renderReconfirmationInfo(inReconfirmUserData)
      screen.getByText(/Are you still at/)
      screen.getByText('SSO University')
      screen.getByText(
        /Please take a moment to confirm your institutional email address/
      )
      screen.getByRole('link', {
        name: 'Learn more about institutional email reconfirmation.',
      })
      expect(screen.queryByText(/add a new primary email address/)).to.not.exist
    })

    it('renders default emails prompt', function () {
      inReconfirmUserData.default = true
      renderReconfirmationInfo(inReconfirmUserData)
      screen.getByText(/add a new primary email address/)
    })

    describe('SAML reconfirmations', function () {
      beforeEach(function () {
        Object.assign(getMeta('ol-ExposedSettings'), {
          hasSamlFeature: true,
          samlInitPath: '/saml/init',
        })
      })

      it('redirects to SAML flow', async function () {
        renderReconfirmationInfo(inReconfirmUserData)
        const confirmButton = screen.getByRole('button', {
          name: 'Confirm affiliation',
        }) as HTMLButtonElement

        await waitFor(() => {
          expect(confirmButton.disabled).to.be.false
        })
        fireEvent.click(confirmButton)

        await waitFor(() => {
          expect(confirmButton.disabled).to.be.true
        })
        sinon.assert.calledOnce(this.locationWrapperStub.assign)
        sinon.assert.calledWithMatch(
          this.locationWrapperStub.assign,
          '/saml/init?university_id=2&reconfirm=/user/settings'
        )
      })
    })

    describe('Email reconfirmations', function () {
      beforeEach(function () {
        Object.assign(getMeta('ol-ExposedSettings'), {
          hasSamlFeature: false,
        })
        fetchMock.post('/user/emails/send-confirmation-code', 200)
      })

      it('sends and resends confirmation email', async function () {
        renderReconfirmationInfo(inReconfirmUserData)
        const confirmButton = (await screen.findByRole('button', {
          name: 'Send confirmation code',
        })) as HTMLButtonElement

        await waitFor(() => {
          expect(confirmButton.disabled).to.be.false
        })
        fireEvent.click(confirmButton)

        await waitFor(() => {
          expect(confirmButton.disabled).to.be.true
        })
        expect(fetchMock.callHistory.called()).to.be.true

        // the confirmation text should now be displayed
        await screen.findByLabelText(
          /Enter the 6-digit code sent to sso-prof@sso-university\.edu/
        )

        // try the resend button
        fetchMock.clearHistory()
        const resendButton = await screen.findByRole('button', {
          name: /Resend confirmation code/,
        })

        fireEvent.click(resendButton)

        // commented out as it's already gone by this point
        // await screen.findByText(/Sending/)
        expect(fetchMock.callHistory.called()).to.be.true
        await waitForElementToBeRemoved(() =>
          screen.getByText('Resending confirmation code')
        )
        await screen.findByRole('button', {
          name: 'Resend confirmation code',
        })
      })
    })
  })
})
