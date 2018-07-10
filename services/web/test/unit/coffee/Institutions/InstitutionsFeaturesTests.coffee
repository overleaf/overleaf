SandboxedModule = require('sandboxed-module')
assert = require('assert')
require('chai').should()
expect = require('chai').expect
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Institutions/InstitutionsFeatures.js'

describe 'InstitutionsFeatures', ->

	beforeEach ->
		@UserGetter = getUserFullEmails: sinon.stub()
		@PlansLocator = findLocalPlanInSettings: sinon.stub()
		@institutionPlanCode = 'institution_plan_code'
		@InstitutionsFeatures = SandboxedModule.require modulePath, requires:
			'../User/UserGetter': @UserGetter
			'../Subscription/PlansLocator': @PlansLocator
			'settings-sharelatex': institutionPlanCode: @institutionPlanCode
			'logger-sharelatex':
				log:->
				err:->

		@userId = '12345abcde'

	describe "hasLicence", ->
			it 'should handle error', (done)->
				@UserGetter.getUserFullEmails.yields(new Error('Nope'))
				@InstitutionsFeatures.hasLicence @userId, (error, hasLicence) ->
					expect(error).to.exist
					done()

			it 'should return false if user has no affiliations', (done) ->
				@UserGetter.getUserFullEmails.yields(null, [])
				@InstitutionsFeatures.hasLicence @userId, (error, hasLicence) ->
					expect(error).to.not.exist
					expect(hasLicence).to.be.false
					done()

			it 'should return false if user has no confirmed affiliations', (done) ->
				affiliations = [
					{ confirmedAt: null, affiliation: institution: { licence: 'pro_plus' } }
				]
				@UserGetter.getUserFullEmails.yields(null, affiliations)
				@InstitutionsFeatures.hasLicence @userId, (error, hasLicence) ->
					expect(error).to.not.exist
					expect(hasLicence).to.be.false
					done()

			it 'should return false if user has no paid affiliations', (done) ->
				affiliations = [
					{ confirmedAt: new Date(), affiliation: institution: { licence: 'free' } }
				]
				@UserGetter.getUserFullEmails.yields(null, affiliations)
				@InstitutionsFeatures.hasLicence @userId, (error, hasLicence) ->
					expect(error).to.not.exist
					expect(hasLicence).to.be.false
					done()

			it 'should return true if user has confirmed paid affiliation', (done)->
				affiliations = [
					{ confirmedAt: new Date(), affiliation: institution: { licence: 'pro_plus' } }
					{ confirmedAt: new Date(), affiliation: institution: { licence: 'free' } }
					{ confirmedAt: null, affiliation: institution: { licence: 'pro' } }
					{ confirmedAt: null, affiliation: institution: { licence: null } }
					{ confirmedAt: new Date(), affiliation: institution: {} }
				]
				@UserGetter.getUserFullEmails.yields(null, affiliations)
				@InstitutionsFeatures.hasLicence @userId, (error, hasLicence) ->
					expect(error).to.not.exist
					expect(hasLicence).to.be.true
					done()

	describe "getInstitutionsFeatures", ->
			beforeEach ->
				@InstitutionsFeatures.hasLicence = sinon.stub()
				@testFeatures = features: { institution: 'all' }
				@PlansLocator.findLocalPlanInSettings.withArgs(@institutionPlanCode).returns(@testFeatures)

			it 'should handle error', (done)->
				@InstitutionsFeatures.hasLicence.yields(new Error('Nope'))
				@InstitutionsFeatures.getInstitutionsFeatures @userId, (error, features) ->
					expect(error).to.exist
					done()

			it 'should return no feaures if user has no plan code', (done) ->
				@InstitutionsFeatures.hasLicence.yields(null, false)
				@InstitutionsFeatures.getInstitutionsFeatures @userId, (error, features) ->
					expect(error).to.not.exist
					expect(features).to.deep.equal {}
					done()

			it 'should return feaures if user has affiliations plan code', (done) ->
				@InstitutionsFeatures.hasLicence.yields(null, true)
				@InstitutionsFeatures.getInstitutionsFeatures @userId, (error, features) =>
					expect(error).to.not.exist
					expect(features).to.deep.equal @testFeatures.features
					done()
