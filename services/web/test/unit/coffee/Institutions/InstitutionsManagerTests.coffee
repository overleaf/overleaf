should = require('chai').should()
SandboxedModule = require('sandboxed-module')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Institutions/InstitutionsManager"

describe "InstitutionsManager", ->
	beforeEach ->
		@institutionId = 123
		@logger = log: ->
		@getInstitutionAffiliations = sinon.stub()
		@refreshFeatures = sinon.stub().yields()
		@InstitutionsManager = SandboxedModule.require modulePath, requires:
			'logger-sharelatex': @logger
			'./InstitutionsAPI':
				getInstitutionAffiliations: @getInstitutionAffiliations
			'../Subscription/FeaturesUpdater':
				refreshFeatures: @refreshFeatures

	describe 'upgradeInstitutionUsers', ->
		it 'refresh all users Features', (done) ->
			affiliations = [
				{ user_id: '123abc123abc123abc123abc' }
				{ user_id: '456def456def456def456def' }
			]
			@getInstitutionAffiliations.yields(null, affiliations)
			@InstitutionsManager.upgradeInstitutionUsers @institutionId, (error) =>
				should.not.exist(error)
				sinon.assert.calledTwice(@refreshFeatures)
				done()
