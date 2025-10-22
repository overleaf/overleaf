import { vi, expect } from 'vitest'
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

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock('../../../../app/src/Features/Subscription/PlansLocator', () => ({
      default: ctx.PlansLocator,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: {
        institutionPlanCode: ctx.institutionPlanCode,
      },
    }))

    ctx.InstitutionsFeatures = (await import(modulePath)).default
    ctx.emailDataWithLicense = [{ emailHasInstitutionLicence: true }]
    ctx.emailDataWithoutLicense = [{ emailHasInstitutionLicence: false }]
    ctx.userId = '12345abcde'
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

    it('should return no feaures if user has no plan code', async function (ctx) {
      ctx.UserGetter.promises.getUserFullEmails.resolves(
        ctx.emailDataWithoutLicense
      )
      const features =
        await ctx.InstitutionsFeatures.promises.getInstitutionsFeatures(
          ctx.userId
        )
      expect(features).to.deep.equal({})
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
