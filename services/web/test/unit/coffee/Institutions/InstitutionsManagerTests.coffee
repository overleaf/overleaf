should = require('chai').should()
SandboxedModule = require('sandboxed-module')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Institutions/InstitutionsManager"
expect = require('chai').expect

describe "InstitutionsManager", ->
	beforeEach ->
		@institutionId = 123
		@logger = log: ->
		@getInstitutionAffiliations = sinon.stub()
		@refreshFeatures = sinon.stub().yields()
		@getUsersByAnyConfirmedEmail = sinon.stub().yields()
		@InstitutionsManager = SandboxedModule.require modulePath, requires:
			'logger-sharelatex': @logger
			'./InstitutionsAPI':
				getInstitutionAffiliations: @getInstitutionAffiliations
			'../Subscription/FeaturesUpdater':
				refreshFeatures: @refreshFeatures
			'../User/UserGetter':
				getUsersByAnyConfirmedEmail: @getUsersByAnyConfirmedEmail

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

	describe.only 'checkInstitutionUsers', ->
		it 'check all users Features', (done) ->
			affiliations = [
				{ email: 'foo@bar.com' }
				{ email: 'baz@boo.edu' }
			]
			stubbedUsers = [
				{
					_id: '123abc123abc123abc123abc'
					features: {collaborators: -1, trackChanges: true}
				}
				{
					_id: '456def456def456def456def'
					features: {collaborators: 10, trackChanges: false}
				}
				{
					_id: '789def789def789def789def'
					features: {collaborators: -1, trackChanges: false}
				}
			]
			@getInstitutionAffiliations.yields(null, affiliations)
			@getUsersByAnyConfirmedEmail.yields(null, stubbedUsers)
			@InstitutionsManager.checkInstitutionUsers @institutionId, (error, usersSummary) =>
				should.not.exist(error)
				usersSummary.totalConfirmedUsers.should.equal 3
				usersSummary.totalConfirmedProUsers.should.equal 1
				usersSummary.totalConfirmedNonProUsers.should.equal 2
				expect(usersSummary.confirmedNonProUsers).to.deep.equal ['456def456def456def456def', '789def789def789def789def']
				done()