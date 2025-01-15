import { expect } from 'chai'
import { cloneDeep } from 'lodash'
import { renderHook } from '@testing-library/react-hooks'
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
} from '../fixtures/test-user-email-data'
import localStorage from '@/infrastructure/local-storage'

const renderUserEmailsContext = () =>
  renderHook(() => useUserEmailsContext(), {
    wrapper: ({ children }) => (
      <UserEmailsProvider>{children}</UserEmailsProvider>
    ),
  })

describe('UserEmailContext', function () {
  beforeEach(function () {
    fetchMock.reset()
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
      await fetchMock.flush(true)
      expect(fetchMock.calls()).to.have.lengthOf(1)
      expect(result.current.state.data.byId).to.deep.equal({
        'bar@overleaf.com': confirmedUserData,
        'baz@overleaf.com': unconfirmedUserData,
        'foo@overleaf.com': professionalUserData,
        'qux@overleaf.com': unconfirmedCommonsUserData,
      })
      expect(result.current.state.data.linkedInstitutionIds).to.have.lengthOf(0)

      expect(result.current.isInitializing).to.equal(false)
      expect(result.current.isInitializingSuccess).to.equal(true)
    })

    it('when loading user email fails, it should update the initialisation state to "failed"', async function () {
      fetchMock.get(/\/user\/emails/, 500)
      const { result } = renderUserEmailsContext()
      await fetchMock.flush()

      expect(result.current.isInitializing).to.equal(false)
      expect(result.current.isInitializingError).to.equal(true)
    })

    describe('state.isLoading', function () {
      it('should be `true` on bootstrap', function () {
        const { result } = renderUserEmailsContext()
        expect(result.current.state.isLoading).to.equal(true)
      })

      it('should be updated with `setLoading`', function () {
        const { result } = renderUserEmailsContext()
        result.current.setLoading(true)
        expect(result.current.state.isLoading).to.equal(true)
        result.current.setLoading(false)
        expect(result.current.state.isLoading).to.equal(false)
      })
    })
  })
  describe('context initialised', function () {
    let result: { current: EmailContextType }

    beforeEach(async function () {
      fetchMock.get(/\/user\/emails/, fakeUsersData)
      const value = renderUserEmailsContext()
      result = value.result
      await fetchMock.flush(true)
    })

    describe('getEmails()', function () {
      beforeEach(async function () {
        fetchMock.reset()
      })

      it('should set `isLoading === true`', function () {
        fetchMock.get(/\/user\/emails/, [
          {
            email: 'new@email.com',
            default: true,
          },
        ])
        result.current.getEmails()
        expect(result.current.state.isLoading).to.be.true
      })

      it('requests a new set of emails', async function () {
        const emailData = {
          email: 'new@email.com',
          default: true,
        }
        fetchMock.get(/\/user\/emails/, [emailData])
        result.current.getEmails()
        await fetchMock.flush(true)
        expect(result.current.state.data.byId).to.deep.equal({
          'new@email.com': emailData,
        })
      })

      it('should populate `linkedInstitutionIds`', async function () {
        fetchMock.get(/\/user\/emails/, [
          confirmedUserData,
          { ...unconfirmedUserData, samlProviderId: 'saml_provider_1' },
          { ...professionalUserData, samlProviderId: 'saml_provider_2' },
        ])
        const { result } = renderUserEmailsContext()
        await fetchMock.flush(true)
        expect(result.current.state.data.linkedInstitutionIds).to.deep.equal([
          'saml_provider_1',
          'saml_provider_2',
        ])
      })
    })

    describe('makePrimary()', function () {
      it('sets an email as `default`', function () {
        expect(result.current.state.data.byId['bar@overleaf.com'].default).to.be
          .false
        result.current.makePrimary('bar@overleaf.com')
        expect(result.current.state.data.byId['bar@overleaf.com'].default).to.be
          .true
      })

      it('sets `default=false` for the current primary email ', function () {
        expect(result.current.state.data.byId['foo@overleaf.com'].default).to.be
          .true
        result.current.makePrimary('bar@overleaf.com')
        expect(result.current.state.data.byId['foo@overleaf.com'].default).to.be
          .false
      })

      it('produces no effect when passing a non-existing email', function () {
        const emails = cloneDeep(result.current.state.data.byId)
        result.current.makePrimary('non-existing@email.com')
        expect(result.current.state.data.byId).to.deep.equal(emails)
      })
    })

    describe('deleteEmail()', function () {
      it('removes data from the deleted email', function () {
        result.current.deleteEmail('bar@overleaf.com')
        expect(result.current.state.data.byId['bar@overleaf.com']).to.be
          .undefined
      })

      it('produces no effect when passing a non-existing email', function () {
        const emails = cloneDeep(result.current.state.data.byId)
        result.current.deleteEmail('non-existing@email.com')
        expect(result.current.state.data.byId).to.deep.equal(emails)
      })
    })

    describe('setEmailAffiliationBeingEdited()', function () {
      it('sets an email as currently being edited', function () {
        result.current.setEmailAffiliationBeingEdited('bar@overleaf.com')
        expect(result.current.state.data.emailAffiliationBeingEdited).to.equal(
          'bar@overleaf.com'
        )

        result.current.setEmailAffiliationBeingEdited(null)
        expect(result.current.state.data.emailAffiliationBeingEdited).to.be.null
      })

      it('produces no effect when passing a non-existing email', function () {
        expect(result.current.state.data.emailAffiliationBeingEdited).to.be.null
        result.current.setEmailAffiliationBeingEdited('non-existing@email.com')
        expect(result.current.state.data.emailAffiliationBeingEdited).to.be.null
      })
    })

    describe('updateAffiliation()', function () {
      it('updates affiliation data for an email', function () {
        result.current.updateAffiliation(
          'foo@overleaf.com',
          'new role',
          'new department'
        )
        expect(
          result.current.state.data.byId['foo@overleaf.com'].affiliation!.role
        ).to.equal('new role')
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

    describe('resetLeaversSurveyExpiration()', function () {
      beforeEach(function () {
        localStorage.removeItem('showInstitutionalLeaversSurveyUntil')
      })

      it('when the leaver has institution license, and there is another email with institution license, it should not reset the survey expiration date', async function () {
        const affiliatedEmail1 = cloneDeep(professionalUserData)
        affiliatedEmail1.email = 'institution-test@example.com'
        affiliatedEmail1.emailHasInstitutionLicence = true

        const affiliatedEmail2 = cloneDeep(professionalUserData)
        affiliatedEmail2.emailHasInstitutionLicence = true

        fetchMock.reset()
        fetchMock.get(/\/user\/emails/, [affiliatedEmail1, affiliatedEmail2])

        result.current.getEmails()
        await fetchMock.flush(true)

        // `resetLeaversSurveyExpiration` always happens after deletion
        result.current.deleteEmail(affiliatedEmail1.email)
        result.current.resetLeaversSurveyExpiration(affiliatedEmail1)

        const expiration = localStorage.getItem(
          'showInstitutionalLeaversSurveyUntil'
        ) as number
        expect(expiration).to.be.null
      })

      it("when the leaver's affiliation is past reconfirmation date, and there is another email with institution license, it should not reset the survey expiration date", async function () {
        const affiliatedEmail1 = cloneDeep(professionalUserData)
        affiliatedEmail1.email = 'institution-test@example.com'
        affiliatedEmail1.affiliation.pastReconfirmDate = true

        const affiliatedEmail2 = cloneDeep(professionalUserData)
        affiliatedEmail2.emailHasInstitutionLicence = true

        fetchMock.reset()
        fetchMock.get(/\/user\/emails/, [affiliatedEmail1, affiliatedEmail2])

        result.current.getEmails()
        await fetchMock.flush(true)

        // `resetLeaversSurveyExpiration` always happens after deletion
        result.current.deleteEmail(affiliatedEmail1.email)
        result.current.resetLeaversSurveyExpiration(affiliatedEmail1)

        const expiration = localStorage.getItem(
          'showInstitutionalLeaversSurveyUntil'
        ) as number
        expect(expiration).to.be.null
      })

      it('when there are no other emails with institution license, it should reset the survey expiration date', async function () {
        const affiliatedEmail1 = cloneDeep(professionalUserData)
        affiliatedEmail1.emailHasInstitutionLicence = true
        affiliatedEmail1.email = 'institution-test@example.com'
        affiliatedEmail1.affiliation.pastReconfirmDate = true

        fetchMock.reset()
        fetchMock.get(/\/user\/emails/, [confirmedUserData, affiliatedEmail1])

        result.current.getEmails()
        await fetchMock.flush(true)

        // `resetLeaversSurveyExpiration` always happens after deletion
        result.current.deleteEmail(affiliatedEmail1.email)
        result.current.resetLeaversSurveyExpiration(affiliatedEmail1)

        expect(
          localStorage.getItem('showInstitutionalLeaversSurveyUntil')
        ).to.be.greaterThan(Date.now())
      })

      it("when the leaver has no institution license, it shouldn't reset the survey expiration date", async function () {
        const emailWithInstitutionLicense = cloneDeep(professionalUserData)
        emailWithInstitutionLicense.email = 'institution-licensed@example.com'
        emailWithInstitutionLicense.emailHasInstitutionLicence = false

        fetchMock.reset()
        fetchMock.get(/\/user\/emails/, [emailWithInstitutionLicense])

        result.current.getEmails()
        await fetchMock.flush(true)

        // `resetLeaversSurveyExpiration` always happens after deletion
        result.current.deleteEmail(emailWithInstitutionLicense.email)
        result.current.resetLeaversSurveyExpiration(professionalUserData)

        expect(localStorage.getItem('showInstitutionalLeaversSurveyUntil')).to
          .be.null
      })

      it("when the leaver is not past its reconfirmation date, it shouldn't reset the survey expiration date", async function () {
        const emailWithInstitutionLicense = cloneDeep(professionalUserData)
        emailWithInstitutionLicense.email = 'institution-licensed@example.com'
        emailWithInstitutionLicense.affiliation.pastReconfirmDate = false

        fetchMock.reset()
        fetchMock.get(/\/user\/emails/, [emailWithInstitutionLicense])

        result.current.getEmails()
        await fetchMock.flush(true)

        // `resetLeaversSurveyExpiration` always happens after deletion
        result.current.deleteEmail(emailWithInstitutionLicense.email)
        result.current.resetLeaversSurveyExpiration(professionalUserData)

        expect(localStorage.getItem('showInstitutionalLeaversSurveyUntil')).to
          .be.null
      })
    })
  })
})
