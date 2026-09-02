import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
const modulePath =
  '../../../../app/src/Features/Institutions/InstitutionsGetter.mjs'

describe('InstitutionsGetter', function () {
  beforeEach(async function (ctx) {
    ctx.UserGetter = {
      getUserFullEmails: sinon.stub(),
      promises: {
        getUserFullEmails: sinon.stub(),
      },
    }

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/UserMembership/UserMembershipsHandler',
      () => ({
        default: (ctx.UserMembershipsHandler = {}),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/UserMembership/UserMembershipEntityConfigs',
      () => ({
        default: (ctx.UserMembershipEntityConfigs = {}),
      })
    )

    ctx.InstitutionsGetter = (await import(modulePath)).default

    ctx.userId = '12345abcde'
    ctx.confirmedAffiliation = {
      confirmedAt: new Date(),
      affiliation: {
        institution: { id: 456, confirmed: true },
        cachedPastReconfirmDate: false,
        pastReconfirmDate: false,
      },
    }
    ctx.confirmedAffiliationPastReconfirmation = {
      confirmedAt: new Date('2000-01-01'),
      affiliation: {
        institution: { id: 135, confirmed: true },
        cachedPastReconfirmDate: true,
        pastReconfirmDate: true,
      },
    }
    ctx.licencedAffiliation = {
      confirmedAt: new Date(),
      affiliation: {
        licence: 'pro_plus',
        institution: { id: 777, confirmed: true },
        cachedPastReconfirmDate: false,
        pastReconfirmDate: false,
      },
    }
    ctx.licencedAffiliationPastReconfirmation = {
      confirmedAt: new Date('2000-01-01'),
      affiliation: {
        licence: 'pro_plus',
        institution: { id: 888, confirmed: true },
        cachedPastReconfirmDate: true,
        pastReconfirmDate: true,
      },
    }
    ctx.unconfirmedEmailLicensedAffiliation = {
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
    ctx.unconfirmedDomainLicensedAffiliation = {
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
    ctx.userEmails = [
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
      ctx.confirmedAffiliation,
      ctx.confirmedAffiliation,
      ctx.confirmedAffiliationPastReconfirmation,
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
    ctx.fullEmailCollection = [
      ctx.licencedAffiliation,
      ctx.licencedAffiliation,
      ctx.licencedAffiliationPastReconfirmation,
      ctx.confirmedAffiliation,
      ctx.confirmedAffiliationPastReconfirmation,
      ctx.unconfirmedDomainLicensedAffiliation,
      ctx.unconfirmedEmailLicensedAffiliation,
    ]

    // Fixtures for getCurrentEntitledAffiliations, which keys off
    // emailHasInstitutionLicence (the user is entitled to a licence with that
    // institution). That flag is derived by UserGetter via
    // InstitutionsHelper.emailHasLicence, whose own conditions (confirmed
    // email, confirmed institution, non-free licence, not past reconfirmation)
    // are covered in InstitutionHelper.test.mjs.
    ctx.entitledAffiliation = {
      emailHasInstitutionLicence: true,
      affiliation: { institution: { id: 456, confirmed: true } },
    }
    ctx.unentitledAffiliation = {
      emailHasInstitutionLicence: false,
      affiliation: { institution: { id: 999, confirmed: true } },
    }
  })

  describe('getCurrentEntitledAffiliations', function () {
    it('returns the affiliations for emails the user is entitled to a licence for and filters out the rest', async function (ctx) {
      ctx.UserGetter.promises.getUserFullEmails.resolves([
        ctx.entitledAffiliation,
        ctx.unentitledAffiliation,
      ])
      const affiliations =
        await ctx.InstitutionsGetter.promises.getCurrentEntitledAffiliations(
          ctx.userId
        )
      expect(affiliations.map(a => a.institution.id)).to.deep.equal([456])
    })

    it('returns no affiliations when the user is not entitled to any', async function (ctx) {
      ctx.UserGetter.promises.getUserFullEmails.resolves([
        ctx.unentitledAffiliation,
      ])
      const affiliations =
        await ctx.InstitutionsGetter.promises.getCurrentEntitledAffiliations(
          ctx.userId
        )
      expect(affiliations).to.deep.equal([])
    })

    it('handles empty response', async function (ctx) {
      ctx.UserGetter.promises.getUserFullEmails.resolves([])
      const affiliations =
        await ctx.InstitutionsGetter.promises.getCurrentEntitledAffiliations(
          ctx.userId
        )
      expect(affiliations).to.deep.equal([])
    })

    it('handles errors', async function (ctx) {
      ctx.UserGetter.promises.getUserFullEmails.rejects(new Error('oops'))
      let e
      try {
        await ctx.InstitutionsGetter.promises.getCurrentEntitledAffiliations(
          ctx.userId
        )
      } catch (error) {
        e = error
      }
      expect(e.message).to.equal('oops')
    })
  })

  describe('getCurrentInstitutionIds', function () {
    it('filters unconfirmed affiliations, those past reconfirmation, and returns only 1 result per institution', async function (ctx) {
      ctx.UserGetter.promises.getUserFullEmails.resolves(ctx.userEmails)
      const institutions =
        await ctx.InstitutionsGetter.promises.getCurrentInstitutionIds(
          ctx.userId
        )
      expect(institutions.length).to.equal(1)
      expect(institutions[0]).to.equal(456)
    })
    it('handles empty response', async function (ctx) {
      ctx.UserGetter.promises.getUserFullEmails.resolves([])
      const institutions =
        await ctx.InstitutionsGetter.promises.getCurrentInstitutionIds(
          ctx.userId
        )
      expect(institutions).to.deep.equal([])
    })
    it('handles errors', async function (ctx) {
      ctx.UserGetter.promises.getUserFullEmails.rejects(new Error('oops'))
      let e
      try {
        await ctx.InstitutionsGetter.promises.getCurrentInstitutionIds(
          ctx.userId
        )
      } catch (error) {
        e = error
      }
      expect(e.message).to.equal('oops')
    })
  })

  describe('getCurrentAndPastAffiliationIds', function () {
    it('filters unconfirmed affiliations, preserves those past reconfirmation, and returns only 1 result per institution', async function (ctx) {
      ctx.UserGetter.promises.getUserFullEmails.resolves(
        ctx.fullEmailCollection
      )
      const institutions =
        await ctx.InstitutionsGetter.promises.getCurrentAndPastAffiliationIds(
          ctx.userId
        )
      expect(institutions).to.deep.equal([777, 888, 456, 135])
    })
    it('handles empty response', async function (ctx) {
      ctx.UserGetter.promises.getUserFullEmails.resolves([])
      const institutions =
        await ctx.InstitutionsGetter.promises.getCurrentInstitutionIds(
          ctx.userId
        )
      expect(institutions).to.deep.equal([])
    })
  })

  describe('getCurrentInstitutionsWithLicence', function () {
    it('returns one result per institution and filters out affiliations without license', async function (ctx) {
      ctx.UserGetter.promises.getUserFullEmails.resolves(
        ctx.fullEmailCollection
      )
      const institutions =
        await ctx.InstitutionsGetter.promises.getCurrentInstitutionsWithLicence(
          ctx.userId
        )
      expect(institutions.map(institution => institution.id)).to.deep.equal([
        ctx.licencedAffiliation.affiliation.institution.id,
      ])
    })
  })
})
