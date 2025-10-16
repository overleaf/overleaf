import { render, screen } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import { cloneDeep } from 'lodash'
import EmailsRow from '../../../../../../frontend/js/features/settings/components/emails/row'
import {
  professionalUserData,
  unconfirmedUserData,
} from '../../fixtures/test-user-email-data'
import { UserEmailData } from '../../../../../../types/user-email'
import { UserEmailsProvider } from '../../../../../../frontend/js/features/settings/context/user-email-context'
import { Affiliation } from '../../../../../../types/affiliation'
import getMeta from '@/utils/meta'

function renderEmailsRow(data: UserEmailData) {
  return render(
    <UserEmailsProvider>
      <EmailsRow userEmailData={data} />
    </UserEmailsProvider>
  )
}

function getByTextContent(text: string) {
  return screen.getAllByText(
    (content, node) =>
      content === text || node?.children[0]?.textContent === text
  )
}

describe('<EmailsRow/>', function () {
  beforeEach(function () {
    Object.assign(getMeta('ol-ExposedSettings'), {
      samlInitPath: '/saml',
      hasSamlBeta: true,
    })
    fetchMock.get('/user/emails?ensureAffiliation=true', [])
  })

  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  describe('with unaffiliated email data', function () {
    it('renders email info', function () {
      renderEmailsRow(unconfirmedUserData)
      screen.getByText('baz@overleaf.com')
    })

    it('renders actions', function () {
      renderEmailsRow(unconfirmedUserData)
      screen.getByRole('button', { name: 'Make primary' })
    })
  })

  describe('with affiliated email data', function () {
    it('renders email info', function () {
      renderEmailsRow(professionalUserData)
      screen.getByText('foo@overleaf.com')
      screen.getByText('Primary')
    })

    it('renders actions', function () {
      renderEmailsRow(professionalUserData)
      screen.getByRole('button', { name: 'Remove' })
    })

    it('renders institution info', function () {
      renderEmailsRow(professionalUserData)
      screen.getByText('Overleaf')
      screen.getByText('Reader, Art History')
    })
  })

  describe('with email data affiliated to an institution with SSO available', function () {
    let affiliatedEmail: UserEmailData & { affiliation: Affiliation }

    beforeEach(function () {
      window.metaAttributesCache.get('ol-ExposedSettings').hasSamlFeature = true

      // make sure the institution has SSO available
      affiliatedEmail = cloneDeep(professionalUserData)
      affiliatedEmail.affiliation.institution.confirmed = true
      affiliatedEmail.affiliation.institution.isUniversity = true
      affiliatedEmail.affiliation.institution.ssoEnabled = true
    })

    describe('when the email is not yet linked to the institution', function () {
      beforeEach(async function () {
        fetchMock.removeRoutes().clearHistory()
        fetchMock.get(/\/user\/emails/, [affiliatedEmail, unconfirmedUserData])
        await fetchMock.callHistory.flush(true)
      })

      it('prompts the user to link to their institutional account', function () {
        renderEmailsRow(affiliatedEmail)
        getByTextContent(
          'You can now link your Overleaf account to your Overleaf institutional account.'
        )
        screen.getByRole('button', { name: 'Link accounts' })
      })
    })

    describe('when the email is already linked to the institution', function () {
      beforeEach(async function () {
        affiliatedEmail.samlProviderId = '1'
        fetchMock.removeRoutes().clearHistory()
        fetchMock.get(/\/user\/emails/, [affiliatedEmail, unconfirmedUserData])
        await fetchMock.callHistory.flush(true)
      })

      it('prompts the user to login using their institutional account', function () {
        renderEmailsRow(affiliatedEmail)
        getByTextContent(
          'You can log in to Overleaf through your Overleaf institutional login.'
        )
        expect(screen.queryByRole('button', { name: 'Link accounts' })).to.be
          .null
      })
    })

    describe('and domain capture is also on for group and Commons SSO also enabled', function () {
      // scenario of a Commons account migrating to a group account
      let affiliatedEmailWithDomainCaptureAndCommons: UserEmailData & {
        affiliation: Affiliation
      }
      beforeEach(async function () {
        fetchMock.removeRoutes().clearHistory()

        affiliatedEmailWithDomainCaptureAndCommons = cloneDeep(affiliatedEmail)
        affiliatedEmailWithDomainCaptureAndCommons.affiliation.group = {
          _id: 'grou123',
          domainCaptureEnabled: true,
          managedUsersEnabled: true,
        }

        await fetchMock.callHistory.flush(true)
      })

      it('does not prompt the user to link to their institutional account', function () {
        renderEmailsRow(affiliatedEmailWithDomainCaptureAndCommons)
        expect(() =>
          getByTextContent(
            'You can now link your Overleaf account to your Overleaf institutional account.'
          )
        ).to.throw('Unable to find an element with the text')
        expect(screen.queryByRole('button', { name: 'Link accounts' })).to.be
          .null
      })

      it('still shows users can log in via Commons SSO if already linked', function () {
        affiliatedEmailWithDomainCaptureAndCommons.samlProviderId = '1'
        renderEmailsRow(affiliatedEmailWithDomainCaptureAndCommons)
        getByTextContent(
          'You can log in to Overleaf through your Overleaf institutional login.'
        )
        expect(screen.queryByRole('button', { name: 'Link accounts' })).to.be
          .null
      })
    })
  })
})
