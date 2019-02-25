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
		@user = {}
		@getInstitutionAffiliations = sinon.stub()
		@refreshFeatures = sinon.stub().yields()
		@UserGetter =
			getUsersByAnyConfirmedEmail: sinon.stub().yields()
			getUser: sinon.stub().callsArgWith(1, null, @user)
		@creator =
			create: sinon.stub().callsArg(0)
		@NotificationsBuilder =
			featuresUpgradedByAffiliation: sinon.stub().returns(@creator)
			redundantPersonalSubscription: sinon.stub().returns(@creator)
		@SubscriptionLocator =
			getUsersSubscription: sinon.stub().callsArg(1)
		@institutionWithV1Data =
			name: 'Wombat University'
		@institution =
			fetchV1Data: sinon.stub().callsArgWith(0, null, @institutionWithV1Data)
		@InstitutionModel =
			Institution:
				findOne: sinon.stub().callsArgWith(1, null, @institution)
		@Mongo =
			ObjectId: sinon.stub().returnsArg(0)

		@InstitutionsManager = SandboxedModule.require modulePath, requires:
			'logger-sharelatex': @logger
			'./InstitutionsAPI':
				getInstitutionAffiliations: @getInstitutionAffiliations
			'../Subscription/FeaturesUpdater':
				refreshFeatures: @refreshFeatures
			'../User/UserGetter': @UserGetter
			'../Notifications/NotificationsBuilder': @NotificationsBuilder
			'../Subscription/SubscriptionLocator': @SubscriptionLocator
			'../../models/Institution': @InstitutionModel
			'../../infrastructure/mongojs': @Mongo

	describe 'upgradeInstitutionUsers', ->
		beforeEach ->
			@user1Id = '123abc123abc123abc123abc'
			@user2Id = '456def456def456def456def'
			@affiliations = [
				{ user_id: @user1Id }
				{ user_id: @user2Id }
			]
			@user1 =
				_id: @user1Id
			@user2 =
				_id: @user2Id
			@subscription =
				planCode: 'pro'
				groupPlan: false
			@UserGetter.getUser.withArgs(@user1Id).callsArgWith(1, null, @user1)
			@UserGetter.getUser.withArgs(@user2Id).callsArgWith(1, null, @user2)
			@SubscriptionLocator.getUsersSubscription.withArgs(@user2).callsArgWith(1, null, @subscription)
			@refreshFeatures.withArgs(@user1Id).callsArgWith(2, null, {}, true)
			@getInstitutionAffiliations.yields(null, @affiliations)

		it 'refresh all users Features', (done) ->
			@InstitutionsManager.upgradeInstitutionUsers @institutionId, (error) =>
				should.not.exist(error)
				sinon.assert.calledTwice(@refreshFeatures)
				done()

		it "notifies users if their features have been upgraded", (done) ->
			@InstitutionsManager.upgradeInstitutionUsers @institutionId, (error) =>
				should.not.exist(error)
				sinon.assert.calledOnce(@NotificationsBuilder.featuresUpgradedByAffiliation)
				sinon.assert.calledWith(@NotificationsBuilder.featuresUpgradedByAffiliation, @affiliations[0], @user1)
				done()

		it "notifies users if they have a subscription that should be cancelled", (done) ->
			@InstitutionsManager.upgradeInstitutionUsers @institutionId, (error) =>
				should.not.exist(error)
				sinon.assert.calledOnce(@NotificationsBuilder.redundantPersonalSubscription)
				sinon.assert.calledWith(@NotificationsBuilder.redundantPersonalSubscription, @affiliations[1], @user2)
				done()


	describe 'checkInstitutionUsers', ->
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
			@UserGetter.getUsersByAnyConfirmedEmail.yields(null, stubbedUsers)
			@InstitutionsManager.checkInstitutionUsers @institutionId, (error, usersSummary) =>
				should.not.exist(error)
				usersSummary.totalConfirmedUsers.should.equal 3
				usersSummary.totalConfirmedProUsers.should.equal 1
				usersSummary.totalConfirmedNonProUsers.should.equal 2
				expect(usersSummary.confirmedNonProUsers).to.deep.equal ['456def456def456def456def', '789def789def789def789def']
				done()
