/* eslint-disable
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const { expect } = require('chai')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Institutions/InstitutionsFeatures.js'
)

describe('InstitutionsFeatures', function () {
  beforeEach(function () {
    this.UserGetter = { getUserFullEmails: sinon.stub() }
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

    return (this.userId = '12345abcde')
  })

  describe('hasLicence', function () {
    it('should handle error', function (done) {
      this.UserGetter.getUserFullEmails.yields(new Error('Nope'))
      return this.InstitutionsFeatures.hasLicence(
        this.userId,
        (error, hasLicence) => {
          expect(error).to.exist
          return done()
        }
      )
    })

    it('should return false if user has no paid affiliations', function (done) {
      const emailData = [{ emailHasInstitutionLicence: false }]
      this.UserGetter.getUserFullEmails.yields(null, emailData)
      return this.InstitutionsFeatures.hasLicence(
        this.userId,
        (error, hasLicence) => {
          expect(error).to.not.exist
          expect(hasLicence).to.be.false
          return done()
        }
      )
    })

    it('should return true if user has confirmed paid affiliation', function (done) {
      const emailData = [
        { emailHasInstitutionLicence: true },
        { emailHasInstitutionLicence: false },
      ]
      this.UserGetter.getUserFullEmails.yields(null, emailData)
      return this.InstitutionsFeatures.hasLicence(
        this.userId,
        (error, hasLicence) => {
          expect(error).to.not.exist
          expect(hasLicence).to.be.true
          return done()
        }
      )
    })
  })

  describe('getInstitutionsFeatures', function () {
    beforeEach(function () {
      this.InstitutionsFeatures.getInstitutionsPlan = sinon.stub()
      this.testFeatures = { features: { institution: 'all' } }
      return this.PlansLocator.findLocalPlanInSettings
        .withArgs(this.institutionPlanCode)
        .returns(this.testFeatures)
    })

    it('should handle error', function (done) {
      this.InstitutionsFeatures.getInstitutionsPlan.yields(new Error('Nope'))
      return this.InstitutionsFeatures.getInstitutionsFeatures(
        this.userId,
        (error, features) => {
          expect(error).to.exist
          return done()
        }
      )
    })

    it('should return no feaures if user has no plan code', function (done) {
      this.InstitutionsFeatures.getInstitutionsPlan.yields(null, null)
      return this.InstitutionsFeatures.getInstitutionsFeatures(
        this.userId,
        (error, features) => {
          expect(error).to.not.exist
          expect(features).to.deep.equal({})
          return done()
        }
      )
    })

    it('should return feaures if user has affiliations plan code', function (done) {
      this.InstitutionsFeatures.getInstitutionsPlan.yields(
        null,
        this.institutionPlanCode
      )
      return this.InstitutionsFeatures.getInstitutionsFeatures(
        this.userId,
        (error, features) => {
          expect(error).to.not.exist
          expect(features).to.deep.equal(this.testFeatures.features)
          return done()
        }
      )
    })
  })

  describe('getInstitutionsPlan', function () {
    beforeEach(function () {
      return (this.InstitutionsFeatures.hasLicence = sinon.stub())
    })

    it('should handle error', function (done) {
      this.InstitutionsFeatures.hasLicence.yields(new Error('Nope'))
      return this.InstitutionsFeatures.getInstitutionsPlan(
        this.userId,
        error => {
          expect(error).to.exist
          return done()
        }
      )
    })

    it('should return no plan if user has no licence', function (done) {
      this.InstitutionsFeatures.hasLicence.yields(null, false)
      return this.InstitutionsFeatures.getInstitutionsPlan(
        this.userId,
        (error, plan) => {
          expect(error).to.not.exist
          expect(plan).to.equal(null)
          return done()
        }
      )
    })

    it('should return plan if user has licence', function (done) {
      this.InstitutionsFeatures.hasLicence.yields(null, true)
      return this.InstitutionsFeatures.getInstitutionsPlan(
        this.userId,
        (error, plan) => {
          expect(error).to.not.exist
          expect(plan).to.equal(this.institutionPlanCode)
          return done()
        }
      )
    })
  })
})
