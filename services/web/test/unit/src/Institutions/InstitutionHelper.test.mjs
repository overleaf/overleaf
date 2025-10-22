import { expect } from 'chai'
import InstitutionsHelper from '../../../../app/src/Features/Institutions/InstitutionsHelper.mjs'

describe('InstitutionsHelper', function () {
  describe('emailHasLicence', function () {
    it('returns licence', function () {
      const emailHasLicence = InstitutionsHelper.emailHasLicence({
        confirmedAt: new Date(),
        affiliation: {
          institution: { confirmed: true },
          licence: 'pro_plus',
        },
      })
      expect(emailHasLicence).to.be.true
    })

    it('returns false if licence is free', function () {
      const emailHasLicence = InstitutionsHelper.emailHasLicence({
        confirmedAt: new Date(),
        affiliation: {
          institution: { confirmed: true },
          licence: 'free',
        },
      })
      expect(emailHasLicence).to.be.false
    })

    it('returns false if licence is null', function () {
      const emailHasLicence = InstitutionsHelper.emailHasLicence({
        confirmedAt: new Date(),
        affiliation: {
          institution: { confirmed: true },
          licence: null,
        },
      })
      expect(emailHasLicence).to.be.false
    })

    it('returns false if institution is not confirmed', function () {
      const emailHasLicence = InstitutionsHelper.emailHasLicence({
        confirmedAt: new Date(),
        affiliation: {
          institution: { confirmed: false },
          licence: 'pro_plus',
        },
      })
      expect(emailHasLicence).to.be.false
    })

    it('returns false if email is not confirmed', function () {
      const emailHasLicence = InstitutionsHelper.emailHasLicence({
        confirmedAt: null,
        affiliation: {
          institution: { confirmed: true },
          licence: 'pro_plus',
        },
      })
      expect(emailHasLicence).to.be.false
    })
  })
})
