const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Institutions/InstitutionsGetter.js'
)

describe('InstitutionsGetter', function () {
  beforeEach(function () {
    this.UserGetter = {
      getUserFullEmails: sinon.stub(),
      promises: {
        getUserFullEmails: sinon.stub(),
      },
    }
    this.InstitutionsGetter = SandboxedModule.require(modulePath, {
      requires: {
        '../User/UserGetter': this.UserGetter,
        '../UserMembership/UserMembershipsHandler':
          (this.UserMembershipsHandler = {}),
        '../UserMembership/UserMembershipEntityConfigs':
          (this.UserMembershipEntityConfigs = {}),
      },
    })

    this.userId = '12345abcde'
    this.confirmedAffiliation = {
      confirmedAt: new Date(),
      affiliation: {
        institution: { id: 456, confirmed: true },
        cachedPastReconfirmDate: false,
        pastReconfirmDate: false,
      },
    }
    this.confirmedAffiliationPastReconfirmation = {
      confirmedAt: new Date('2000-01-01'),
      affiliation: {
        institution: { id: 135, confirmed: true },
        cachedPastReconfirmDate: true,
        pastReconfirmDate: true,
      },
    }
    this.licencedAffiliation = {
      confirmedAt: new Date(),
      affiliation: {
        licence: 'pro_plus',
        institution: { id: 777, confirmed: true },
        cachedPastReconfirmDate: false,
        pastReconfirmDate: false,
      },
    }
    this.licencedAffiliationPastReconfirmation = {
      confirmedAt: new Date('2000-01-01'),
      affiliation: {
        licence: 'pro_plus',
        institution: { id: 888, confirmed: true },
        cachedPastReconfirmDate: true,
        pastReconfirmDate: true,
      },
    }
    this.unconfirmedEmailLicensedAffiliation = {
      confirmedAt: null,
      affiliation: {
        licence: 'pro_plus',
        institution: {
          id: 123,
          confirmed: true,
          cachedPastReconfirmDate: false,
          pastReconfirmDate: false,
        },
      },
    }
    this.unconfirmedDomainLicensedAffiliation = {
      confirmedAt: new Date(),
      affiliation: {
        licence: 'pro_plus',
        institution: {
          id: 789,
          confirmed: false,
          cachedPastReconfirmDate: false,
          pastReconfirmDate: false,
        },
      },
    }
    this.userEmails = [
      {
        confirmedAt: null,
        affiliation: {
          institution: {
            id: 123,
            confirmed: true,
            cachedPastReconfirmDate: false,
            pastReconfirmDate: false,
          },
        },
      },
      this.confirmedAffiliation,
      this.confirmedAffiliation,
      this.confirmedAffiliationPastReconfirmation,
      {
        confirmedAt: new Date(),
        affiliation: null,
        cachedPastReconfirmDate: false,
        pastReconfirmDate: false,
      },
      {
        confirmedAt: new Date(),
        affiliation: {
          institution: null,
          cachedPastReconfirmDate: false,
          pastReconfirmDate: false,
        },
      },
      {
        confirmedAt: new Date(),
        affiliation: {
          institution: {
            id: 789,
            confirmed: false,
            cachedPastReconfirmDate: false,
            pastReconfirmDate: false,
          },
        },
      },
    ]
    this.fullEmailCollection = [
      this.licencedAffiliation,
      this.licencedAffiliation,
      this.licencedAffiliationPastReconfirmation,
      this.confirmedAffiliation,
      this.confirmedAffiliationPastReconfirmation,
      this.unconfirmedDomainLicensedAffiliation,
      this.unconfirmedEmailLicensedAffiliation,
    ]
  })

  describe('getCurrentInstitutionIds', function () {
    it('filters unconfirmed affiliations, those past reconfirmation, and returns only 1 result per institution', async function () {
      this.UserGetter.promises.getUserFullEmails.resolves(this.userEmails)
      const institutions =
        await this.InstitutionsGetter.promises.getCurrentInstitutionIds(
          this.userId
        )
      expect(institutions.length).to.equal(1)
      expect(institutions[0]).to.equal(456)
    })
    it('handles empty response', async function () {
      this.UserGetter.promises.getUserFullEmails.resolves([])
      const institutions =
        await this.InstitutionsGetter.promises.getCurrentInstitutionIds(
          this.userId
        )
      expect(institutions).to.deep.equal([])
    })
    it('handles errors', async function () {
      this.UserGetter.promises.getUserFullEmails.rejects(new Error('oops'))
      let e
      try {
        await this.InstitutionsGetter.promises.getCurrentInstitutionIds(
          this.userId
        )
      } catch (error) {
        e = error
      }
      expect(e.message).to.equal('oops')
    })
  })

  describe('getCurrentAndPastAffiliationIds', function () {
    it('filters unconfirmed affiliations, preserves those past reconfirmation, and returns only 1 result per institution', async function () {
      this.UserGetter.promises.getUserFullEmails.resolves(
        this.fullEmailCollection
      )
      const institutions =
        await this.InstitutionsGetter.promises.getCurrentAndPastAffiliationIds(
          this.userId
        )
      expect(institutions).to.deep.equal([777, 888, 456, 135])
    })
    it('handles empty response', async function () {
      this.UserGetter.promises.getUserFullEmails.resolves([])
      const institutions =
        await this.InstitutionsGetter.promises.getCurrentInstitutionIds(
          this.userId
        )
      expect(institutions).to.deep.equal([])
    })
  })

  describe('getCurrentInstitutionsWithLicence', function () {
    it('returns one result per institution and filters out affiliations without license', async function () {
      this.UserGetter.promises.getUserFullEmails.resolves(
        this.fullEmailCollection
      )
      const institutions =
        await this.InstitutionsGetter.promises.getCurrentInstitutionsWithLicence(
          this.userId
        )
      expect(institutions.map(institution => institution.id)).to.deep.equal([
        this.licencedAffiliation.affiliation.institution.id,
      ])
    })
  })
})
