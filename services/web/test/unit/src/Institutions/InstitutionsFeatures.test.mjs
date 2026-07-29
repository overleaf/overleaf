import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import path from 'node:path'

const modulePath = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Institutions/InstitutionsFeatures.mjs'
)

describe('InstitutionsFeatures', function () {
  beforeEach(async function (ctx) {
    ctx.UserGetter = {
      promises: { getUserFullEmails: sinon.stub().resolves([]) },
    }
    ctx.PlansLocator = { findLocalPlanInSettings: sinon.stub() }
    ctx.institutionPlanCode = 'institution_plan_code'
    ctx.InstitutionsGetter = {
      promises: { getCurrentEntitledAffiliations: sinon.stub().resolves([]) },
    }

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock('../../../../app/src/Features/Subscription/PlansLocator', () => ({
      default: ctx.PlansLocator,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: {
        institutionPlanCode: ctx.institutionPlanCode,
        overleaf: {},
        writefull: {
          quotaTierGranted: 'unlimited',
        },
        aiFeatures: {
          freeQuota: 'free',
          standardQuota: 'standard',
          basicQuota: 'basic',
          unlimitedQuota: 'unlimited',
        },
        quotaGrants: {
          ai: {
            free: 5,
            basic: 5,
            standard: 10,
            unlimited: 200,
          },
        },
      },
    }))

    vi.doMock(
      '../../../../app/src/Features/Institutions/InstitutionsGetter',
      () => ({
        default: ctx.InstitutionsGetter,
      })
    )

    ctx.InstitutionsFeatures = (await import(modulePath)).default
    ctx.emailDataWithLicense = [{ emailHasInstitutionLicence: true }]
    ctx.emailDataWithoutLicense = [{ emailHasInstitutionLicence: false }]
    ctx.userId = '12345abcde'
    ctx.affiliateWithAiBundle = {
      institution: { writefullCommonsAccount: true },
    }
    ctx.affiliateWithoutAiBundle = {
      institution: { writefullCommonsAccount: false },
    }
    ctx.testFeatures = { features: { institution: 'all' } }
    ctx.testFeaturesWithAiAddon = {
      features: {
        institution: 'all',
        aiUsageQuota: 'unlimited',
      },
    }
    ctx.testFeaturesWithNoAddon = {
      features: {
        institution: 'all',
        aiUsageQuota: 'basic',
      },
    }
  })

  describe('hasLicence', function () {
    it('should handle error', async function (ctx) {
      ctx.UserGetter.promises.getUserFullEmails.rejects(new Error('Nope'))
      let error

      try {
        await ctx.InstitutionsFeatures.promises.hasLicence(ctx.userId)
      } catch (err) {
        error = err
      }

      expect(error).to.exist
    })

    it('should return false if user has no paid affiliations', async function (ctx) {
      ctx.UserGetter.promises.getUserFullEmails.resolves(
        ctx.emailDataWithoutLicense
      )
      const hasLicence = await ctx.InstitutionsFeatures.promises.hasLicence(
        ctx.userId
      )
      expect(hasLicence).to.be.false
    })

    it('should return true if user has confirmed paid affiliation', async function (ctx) {
      const emailData = [
        { emailHasInstitutionLicence: true },
        { emailHasInstitutionLicence: false },
      ]
      ctx.UserGetter.promises.getUserFullEmails.resolves(emailData)
      const hasLicence = await ctx.InstitutionsFeatures.promises.hasLicence(
        ctx.userId
      )
      expect(hasLicence).to.be.true
    })
  })

  describe('getInstitutionsFeatures', function () {
    beforeEach(function (ctx) {
      ctx.testFeatures = { features: { institution: 'all' } }
      return ctx.PlansLocator.findLocalPlanInSettings
        .withArgs(ctx.institutionPlanCode)
        .returns(ctx.testFeatures)
    })

    it('should handle error', async function (ctx) {
      ctx.UserGetter.promises.getUserFullEmails.rejects(new Error('Nope'))
      await expect(
        ctx.InstitutionsFeatures.promises.getInstitutionsFeatures(ctx.userId)
      ).to.be.rejected
    })

    it('should return no features if user has no plan code', async function (ctx) {
      ctx.UserGetter.promises.getUserFullEmails.resolves(
        ctx.emailDataWithoutLicense
      )
      const features =
        await ctx.InstitutionsFeatures.promises.getInstitutionsFeatures(
          ctx.userId
        )
      expect(features).to.deep.equal({})
    })

    it('should return ai features if the user is entitled to an affiliation with the add-on bundle', async function (ctx) {
      // Only affiliations the user is entitled to reach this point, since the
      // entitlement filtering lives in getCurrentEntitledAffiliations (covered
      // by its own unit tests).
      ctx.InstitutionsGetter.promises.getCurrentEntitledAffiliations.resolves([
        ctx.affiliateWithoutAiBundle,
        ctx.affiliateWithAiBundle,
      ])
      ctx.UserGetter.promises.getUserFullEmails.resolves(
        ctx.emailDataWithLicense
      )

      const features =
        await ctx.InstitutionsFeatures.promises.getInstitutionsFeatures(
          ctx.userId
        )
      expect(features).to.deep.equal(ctx.testFeaturesWithAiAddon.features)
    })

    it('should not return ai features if no entitled affiliation has the add-on bundle', async function (ctx) {
      // The user is entitled to a licence (so gets the institution plan) but
      // none of their entitled affiliations provide the AI bundle.
      ctx.InstitutionsGetter.promises.getCurrentEntitledAffiliations.resolves([
        ctx.affiliateWithoutAiBundle,
      ])
      ctx.UserGetter.promises.getUserFullEmails.resolves(
        ctx.emailDataWithLicense
      )

      const features =
        await ctx.InstitutionsFeatures.promises.getInstitutionsFeatures(
          ctx.userId
        )
      expect(features).to.deep.equal(ctx.testFeatures.features)
      expect(features).to.not.have.property('aiUsageQuota')
      expect(features).to.not.have.property('aiErrorAssistant')
    })

    it('should return feaures if user has affiliations plan code', async function (ctx) {
      ctx.UserGetter.promises.getUserFullEmails.resolves(
        ctx.emailDataWithLicense
      )
      const features =
        await ctx.InstitutionsFeatures.promises.getInstitutionsFeatures(
          ctx.userId
        )
      expect(features).to.deep.equal(ctx.testFeatures.features)
    })
  })

  describe('getInstitutionsPlan', function () {
    it('should handle error', async function (ctx) {
      ctx.UserGetter.promises.getUserFullEmails.rejects(new Error('Nope'))
      await expect(
        ctx.InstitutionsFeatures.promises.getInstitutionsPlan(ctx.userId)
      ).to.be.rejected
    })

    it('should return no plan if user has no licence', async function (ctx) {
      ctx.UserGetter.promises.getUserFullEmails.resolves(
        ctx.emailDataWithoutLicense
      )
      const plan = await ctx.InstitutionsFeatures.promises.getInstitutionsPlan(
        ctx.userId
      )
      expect(plan).to.equal(null)
    })

    it('should return plan if user has licence', async function (ctx) {
      ctx.UserGetter.promises.getUserFullEmails.resolves(
        ctx.emailDataWithLicense
      )
      const plan = await ctx.InstitutionsFeatures.promises.getInstitutionsPlan(
        ctx.userId
      )
      expect(plan).to.equal(ctx.institutionPlanCode)
    })
  })
})
