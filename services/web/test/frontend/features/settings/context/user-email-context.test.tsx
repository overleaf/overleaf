import { expect } from 'chai'
import { cloneDeep } from 'lodash'
import { renderHook, waitFor } from '@testing-library/react'
import {
  EmailContextType,
  UserEmailsProvider,
  useUserEmailsContext,
} from '../../../../../frontend/js/features/settings/context/user-email-context'
import fetchMock from 'fetch-mock'
import {
  confirmedUserData,
  professionalUserData,
  unconfirmedUserData,
  fakeUsersData,
  unconfirmedCommonsUserData,
  untrustedUserData,
} from '../fixtures/test-user-email-data'

const renderUserEmailsContext = () =>
  renderHook(() => useUserEmailsContext(), {
    wrapper: ({ children }) => (
      <UserEmailsProvider>{children}</UserEmailsProvider>
    ),
  })

describe('UserEmailContext', function () {
  beforeEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  describe('context bootstrap', function () {
    it('should start with an "in progress" initialisation state', function () {
      const { result } = renderUserEmailsContext()

      expect(result.current.isInitializing).to.equal(true)
      expect(result.current.isInitializingSuccess).to.equal(false)
      expect(result.current.isInitializingError).to.equal(false)
    })

    it('should start with an empty state', function () {
      const { result } = renderUserEmailsContext()

      expect(result.current.state.data.byId).to.deep.equal({})
      expect(result.current.state.data.emailAffiliationBeingEdited).to.be.null
      expect(result.current.state.data.linkedInstitutionIds).to.have.length(0)
    })

    it('should load all user emails and update the initialisation state to "success"', async function () {
      fetchMock.get(/\/user\/emails/, fakeUsersData)
      const { result } = renderUserEmailsContext()
      await fetchMock.callHistory.flush(true)
      expect(fetchMock.callHistory.calls()).to.have.lengthOf(1)
      await waitFor(() =>
        expect(result.current.state.data.byId).to.deep.equal({
          'bar@overleaf.com': { ...untrustedUserData, ...confirmedUserData },
          'baz@overleaf.com': unconfirmedUserData,
          'foo@overleaf.com': professionalUserData,
          'qux@overleaf.com': unconfirmedCommonsUserData,
        })
      )
      expect(result.current.state.data.linkedInstitutionIds).to.have.lengthOf(0)

      expect(result.current.isInitializing).to.equal(false)
      expect(result.current.isInitializingSuccess).to.equal(true)
    })

    it('when loading user email fails, it should update the initialisation state to "failed"', async function () {
      fetchMock.get(/\/user\/emails/, 500)
      const { result } = renderUserEmailsContext()
      await fetchMock.callHistory.flush()

      await waitFor(() => expect(result.current.isInitializing).to.equal(false))
      expect(result.current.isInitializingError).to.equal(true)
    })

    describe('state.isLoading', function () {
      it('should be `true` on bootstrap', function () {
        const { result } = renderUserEmailsContext()
        expect(result.current.state.isLoading).to.equal(true)
      })

      it('should be updated with `setLoading`', async function () {
        const { result } = renderUserEmailsContext()
        result.current.setLoading(true)
        await waitFor(() =>
          expect(result.current.state.isLoading).to.equal(true)
        )
        result.current.setLoading(false)
        await waitFor(() =>
          expect(result.current.state.isLoading).to.equal(false)
        )
      })
    })
  })
  describe('context initialised', function () {
    let result: { current: EmailContextType }

    beforeEach(async function () {
      fetchMock.get(/\/user\/emails/, fakeUsersData)
      const value = renderUserEmailsContext()
      result = value.result
      await fetchMock.callHistory.flush(true)
    })

    describe('getEmails()', function () {
      beforeEach(async function () {
        fetchMock.removeRoutes().clearHistory()
      })

      it('should set `isLoading === true`', async function () {
        fetchMock.get(
          /\/user\/emails/,
          [
            {
              email: 'new@email.com',
              default: true,
            },
          ],
          { delay: 100 }
        )
        result.current.getEmails()
        await waitFor(() => expect(result.current.state.isLoading).to.be.true)
      })

      it('requests a new set of emails', async function () {
        const emailData = {
          email: 'new@email.com',
          default: true,
        }
        fetchMock.get(/\/user\/emails/, [emailData])
        result.current.getEmails()
        await fetchMock.callHistory.flush(true)
        await waitFor(() =>
          expect(result.current.state.data.byId).to.deep.equal({
            'new@email.com': emailData,
          })
        )
      })

      it('should populate `linkedInstitutionIds`', async function () {
        fetchMock.get(/\/user\/emails/, [
          confirmedUserData,
          { ...unconfirmedUserData, samlProviderId: 'saml_provider_1' },
          { ...professionalUserData, samlProviderId: 'saml_provider_2' },
        ])
        const { result } = renderUserEmailsContext()
        await fetchMock.callHistory.flush(true)
        await waitFor(() =>
          expect(result.current.state.data.linkedInstitutionIds).to.deep.equal([
            'saml_provider_1',
            'saml_provider_2',
          ])
        )
      })
    })

    describe('makePrimary()', function () {
      it('sets an email as `default`', async function () {
        expect(result.current.state.data.byId['bar@overleaf.com'].default).to.be
          .false
        result.current.makePrimary('bar@overleaf.com')
        await waitFor(
          () =>
            expect(result.current.state.data.byId['bar@overleaf.com'].default)
              .to.be.true
        )
      })

      it('sets `default=false` for the current primary email ', async function () {
        expect(result.current.state.data.byId['foo@overleaf.com'].default).to.be
          .true
        result.current.makePrimary('bar@overleaf.com')
        await waitFor(
          () =>
            expect(result.current.state.data.byId['foo@overleaf.com'].default)
              .to.be.false
        )
      })

      it('produces no effect when passing a non-existing email', async function () {
        const emails = cloneDeep(result.current.state.data.byId)
        result.current.makePrimary('non-existing@email.com')
        await waitFor(() =>
          expect(result.current.state.data.byId).to.deep.equal(emails)
        )
      })
    })

    describe('deleteEmail()', function () {
      it('removes data from the deleted email', async function () {
        result.current.deleteEmail('bar@overleaf.com')
        await waitFor(
          () =>
            expect(result.current.state.data.byId['bar@overleaf.com']).to.be
              .undefined
        )
      })

      it('produces no effect when passing a non-existing email', function () {
        const emails = cloneDeep(result.current.state.data.byId)
        result.current.deleteEmail('non-existing@email.com')
        expect(result.current.state.data.byId).to.deep.equal(emails)
      })
    })

    describe('setEmailAffiliationBeingEdited()', function () {
      it('sets an email as currently being edited', async function () {
        result.current.setEmailAffiliationBeingEdited('bar@overleaf.com')
        await waitFor(() =>
          expect(
            result.current.state.data.emailAffiliationBeingEdited
          ).to.equal('bar@overleaf.com')
        )

        result.current.setEmailAffiliationBeingEdited(null)
        await waitFor(
          () =>
            expect(result.current.state.data.emailAffiliationBeingEdited).to.be
              .null
        )
      })

      it('produces no effect when passing a non-existing email', function () {
        expect(result.current.state.data.emailAffiliationBeingEdited).to.be.null
        result.current.setEmailAffiliationBeingEdited('non-existing@email.com')
        expect(result.current.state.data.emailAffiliationBeingEdited).to.be.null
      })
    })

    describe('updateAffiliation()', function () {
      it('updates affiliation data for an email', async function () {
        result.current.updateAffiliation(
          'foo@overleaf.com',
          'new role',
          'new department'
        )
        await waitFor(() =>
          expect(
            result.current.state.data.byId['foo@overleaf.com'].affiliation!.role
          ).to.equal('new role')
        )
        expect(
          result.current.state.data.byId['foo@overleaf.com'].affiliation!
            .department
        ).to.equal('new department')
      })

      it('clears an email from currently being edited', function () {
        result.current.setEmailAffiliationBeingEdited('foo@overleaf.com')
        result.current.updateAffiliation(
          'foo@overleaf.com',
          'new role',
          'new department'
        )
        expect(result.current.state.data.emailAffiliationBeingEdited).to.be.null
      })

      it('produces no effect when passing an email with no affiliation', function () {
        const emails = cloneDeep(result.current.state.data.byId)
        result.current.updateAffiliation(
          'bar@overleaf.com',
          'new role',
          'new department'
        )
        expect(result.current.state.data.byId).to.deep.equal(emails)
      })

      it('produces no effect when passing a non-existing email', function () {
        const emails = cloneDeep(result.current.state.data.byId)
        result.current.updateAffiliation(
          'non-existing@email.com',
          'new role',
          'new department'
        )
        expect(result.current.state.data.byId).to.deep.equal(emails)
      })
    })
  })
})
