const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Institutions/InstitutionsFeatures.js'
)

describe('InstitutionsFeatures', function () {
  beforeEach(function () {
    this.UserGetter = {
      promises: { getUserFullEmails: sinon.stub().resolves([]) },
    }
    this.PlansLocator = { findLocalPlanInSettings: sinon.stub() }
    this.institutionPlanCode = 'institution_plan_code'
    this.InstitutionsFeatures = SandboxedModule.require(modulePath, {
      requires: {
        '../User/UserGetter': this.UserGetter,
        '../Subscription/PlansLocator': this.PlansLocator,
        '@overleaf/settings': {
          institutionPlanCode: this.institutionPlanCode,
        },
      },
    })
    this.emailDataWithLicense = [{ emailHasInstitutionLicence: true }]
    this.emailDataWithoutLicense = [{ emailHasInstitutionLicence: false }]
    return (this.userId = '12345abcde')
  })

  describe('hasLicence', function () {
    it('should handle error', async function () {
      this.UserGetter.promises.getUserFullEmails.rejects(new Error('Nope'))
      let error

      try {
        await this.InstitutionsFeatures.promises.hasLicence(this.userId)
      } catch (err) {
        error = err
      }

      expect(error).to.exist
    })

    it('should return false if user has no paid affiliations', async function () {
      this.UserGetter.promises.getUserFullEmails.resolves(
        this.emailDataWithoutLicense
      )
      const hasLicence = await this.InstitutionsFeatures.promises.hasLicence(
        this.userId
      )
      expect(hasLicence).to.be.false
    })

    it('should return true if user has confirmed paid affiliation', async function () {
      const emailData = [
        { emailHasInstitutionLicence: true },
        { emailHasInstitutionLicence: false },
      ]
      this.UserGetter.promises.getUserFullEmails.resolves(emailData)
      const hasLicence = await this.InstitutionsFeatures.promises.hasLicence(
        this.userId
      )
      expect(hasLicence).to.be.true
    })
  })

  describe('getInstitutionsFeatures', function () {
    beforeEach(function () {
      this.testFeatures = { features: { institution: 'all' } }
      return this.PlansLocator.findLocalPlanInSettings
        .withArgs(this.institutionPlanCode)
        .returns(this.testFeatures)
    })

    it('should handle error', async function () {
      this.UserGetter.promises.getUserFullEmails.rejects(new Error('Nope'))
      await expect(
        this.InstitutionsFeatures.promises.getInstitutionsFeatures(this.userId)
      ).to.be.rejected
    })

    it('should return no feaures if user has no plan code', async function () {
      this.UserGetter.promises.getUserFullEmails.resolves(
        this.emailDataWithoutLicense
      )
      const features =
        await this.InstitutionsFeatures.promises.getInstitutionsFeatures(
          this.userId
        )
      expect(features).to.deep.equal({})
    })

    it('should return feaures if user has affiliations plan code', async function () {
      this.UserGetter.promises.getUserFullEmails.resolves(
        this.emailDataWithLicense
      )
      const features =
        await this.InstitutionsFeatures.promises.getInstitutionsFeatures(
          this.userId
        )
      expect(features).to.deep.equal(this.testFeatures.features)
    })
  })

  describe('getInstitutionsPlan', function () {
    it('should handle error', async function () {
      this.UserGetter.promises.getUserFullEmails.rejects(new Error('Nope'))
      await expect(
        this.InstitutionsFeatures.promises.getInstitutionsPlan(this.userId)
      ).to.be.rejected
    })

    it('should return no plan if user has no licence', async function () {
      this.UserGetter.promises.getUserFullEmails.resolves(
        this.emailDataWithoutLicense
      )
      const plan = await this.InstitutionsFeatures.promises.getInstitutionsPlan(
        this.userId
      )
      expect(plan).to.equal(null)
    })

    it('should return plan if user has licence', async function () {
      this.UserGetter.promises.getUserFullEmails.resolves(
        this.emailDataWithLicense
      )
      const plan = await this.InstitutionsFeatures.promises.getInstitutionsPlan(
        this.userId
      )
      expect(plan).to.equal(this.institutionPlanCode)
    })
  })
})
