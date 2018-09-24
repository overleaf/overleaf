SandboxedModule = require('sandboxed-module')
assert = require('assert')
require('chai').should()
expect = require('chai').expect
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Institutions/InstitutionsFeatures.js'

describe 'InstitutionsFeatures', ->

	beforeEach ->
		@InstitutionsGetter = getConfirmedInstitutions: sinon.stub()
		@PlansLocator = findLocalPlanInSettings: sinon.stub()
		@institutionPlanCode = 'institution_plan_code'
		@InstitutionsFeatures = SandboxedModule.require modulePath, requires:
			'./InstitutionsGetter': @InstitutionsGetter
			'../Subscription/PlansLocator': @PlansLocator
			'settings-sharelatex': institutionPlanCode: @institutionPlanCode
			'logger-sharelatex':
				log:->
				err:->

		@userId = '12345abcde'

	describe "hasLicence", ->
			it 'should handle error', (done)->
				@InstitutionsGetter.getConfirmedInstitutions.yields(new Error('Nope'))
				@InstitutionsFeatures.hasLicence @userId, (error, hasLicence) ->
					expect(error).to.exist
					done()

			it 'should return false if user has no confirmed affiliations', (done) ->
				institutions = []
				@InstitutionsGetter.getConfirmedInstitutions.yields(null, institutions)
				@InstitutionsFeatures.hasLicence @userId, (error, hasLicence) ->
					expect(error).to.not.exist
					expect(hasLicence).to.be.false
					done()

			it 'should return false if user has no paid affiliations', (done) ->
				institutions = [
					{ licence: 'free' }
				]
				@InstitutionsGetter.getConfirmedInstitutions.yields(null, institutions)
				@InstitutionsFeatures.hasLicence @userId, (error, hasLicence) ->
					expect(error).to.not.exist
					expect(hasLicence).to.be.false
					done()

			it 'should return true if user has confirmed paid affiliation', (done)->
				institutions = [
					{ licence: 'pro_plus' }
					{ licence: 'free' }
					{ licence: 'pro' }
					{ licence: null }
				]
				@InstitutionsGetter.getConfirmedInstitutions.yields(null, institutions)
				@InstitutionsFeatures.hasLicence @userId, (error, hasLicence) ->
					expect(error).to.not.exist
					expect(hasLicence).to.be.true
					done()

	describe "getInstitutionsFeatures", ->
			beforeEach ->
				@InstitutionsFeatures.getInstitutionsPlan = sinon.stub()
				@testFeatures = features: { institution: 'all' }
				@PlansLocator.findLocalPlanInSettings.withArgs(@institutionPlanCode).returns(@testFeatures)

			it 'should handle error', (done)->
				@InstitutionsFeatures.getInstitutionsPlan.yields(new Error('Nope'))
				@InstitutionsFeatures.getInstitutionsFeatures @userId, (error, features) ->
					expect(error).to.exist
					done()

			it 'should return no feaures if user has no plan code', (done) ->
				@InstitutionsFeatures.getInstitutionsPlan.yields(null, null)
				@InstitutionsFeatures.getInstitutionsFeatures @userId, (error, features) ->
					expect(error).to.not.exist
					expect(features).to.deep.equal {}
					done()

			it 'should return feaures if user has affiliations plan code', (done) ->
				@InstitutionsFeatures.getInstitutionsPlan.yields(null, @institutionPlanCode)
				@InstitutionsFeatures.getInstitutionsFeatures @userId, (error, features) =>
					expect(error).to.not.exist
					expect(features).to.deep.equal @testFeatures.features
					done()

	describe "getInstitutionsPlan", ->
			beforeEach ->
				@InstitutionsFeatures.hasLicence = sinon.stub()

			it 'should handle error', (done)->
				@InstitutionsFeatures.hasLicence.yields(new Error('Nope'))
				@InstitutionsFeatures.getInstitutionsPlan @userId, (error) ->
					expect(error).to.exist
					done()

			it 'should return no plan if user has no licence', (done) ->
				@InstitutionsFeatures.hasLicence.yields(null, false)
				@InstitutionsFeatures.getInstitutionsPlan @userId, (error, plan) ->
					expect(error).to.not.exist
					expect(plan).to.equal null
					done()

			it 'should return plan if user has licence', (done) ->
				@InstitutionsFeatures.hasLicence.yields(null, true)
				@InstitutionsFeatures.getInstitutionsPlan @userId, (error, plan) =>
					expect(error).to.not.exist
					expect(plan).to.equal @institutionPlanCode
					done()
