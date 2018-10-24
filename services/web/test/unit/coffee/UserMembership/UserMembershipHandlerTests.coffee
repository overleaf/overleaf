chai = require('chai')
should = chai.should()
expect = require('chai').expect
sinon = require('sinon')
assertCalledWith = sinon.assert.calledWith
assertNotCalled = sinon.assert.notCalled
ObjectId = require("../../../../app/js/infrastructure/mongojs").ObjectId
modulePath = "../../../../app/js/Features/UserMembership/UserMembershipHandler"
SandboxedModule = require("sandboxed-module")
Errors = require("../../../../app/js/Features/Errors/Errors")
EntityConfigs = require("../../../../app/js/Features/UserMembership/UserMembershipEntityConfigs")

describe 'UserMembershipHandler', ->
	beforeEach ->
		@user = _id: 'mock-user-id'
		@newUser = _id: 'mock-new-user-id', email: 'new-user-email@foo.bar'
		@fakeEntityId = ObjectId()
		@subscription =
			_id: 'mock-subscription-id'
			groupPlan: true
			membersLimit: 10
			member_ids: [ObjectId(), ObjectId()]
			manager_ids: [ObjectId()]
			invited_emails: ['mock-email-1@foo.com']
			teamInvites: [{ email: 'mock-email-1@bar.com' }]
			update: sinon.stub().yields(null)
		@institution =
			_id: 'mock-institution-id'
			v1Id: 123
			managerIds: [ObjectId(), ObjectId(), ObjectId()]
			update: sinon.stub().yields(null)

		@UserMembershipViewModel =
			buildAsync: sinon.stub().yields(null, { _id: 'mock-member-id'})
			build: sinon.stub().returns(@newUser)
		@UserGetter =
			getUserByAnyEmail: sinon.stub().yields(null, @newUser)
		@Institution =
			findOne: sinon.stub().yields(null, @institution)
		@Subscription =
			findOne: sinon.stub().yields(null, @subscription)
		@UserMembershipHandler = SandboxedModule.require modulePath, requires:
			'./UserMembershipViewModel': @UserMembershipViewModel
			'../User/UserGetter': @UserGetter
			'../Errors/Errors': Errors
			'../../models/Institution': Institution: @Institution
			'../../models/Subscription': Subscription: @Subscription
			'logger-sharelatex':
				log: -> 
				err: ->

	describe 'getEntty', ->
		describe 'group subscriptions', ->
			it 'get subscription', (done) ->
				@UserMembershipHandler.getEntity @fakeEntityId, EntityConfigs.group, @user, (error, subscription) =>
					should.not.exist(error)
					expectedQuery =
						groupPlan: true
						_id: @fakeEntityId
						manager_ids: ObjectId(@user._id)
					assertCalledWith(@Subscription.findOne, expectedQuery)
					expect(subscription).to.equal @subscription
					expect(subscription.membersLimit).to.equal 10
					done()

			it 'get for admin', (done) ->
				@UserMembershipHandler.getEntity @fakeEntityId, EntityConfigs.group, { isAdmin: true }, (error, subscription) =>
					should.not.exist(error)
					expectedQuery =
						groupPlan: true
						_id: @fakeEntityId
					assertCalledWith(@Subscription.findOne, expectedQuery)
					done()

			it 'handle error', (done) ->
				@Subscription.findOne.yields(new Error('some error'))
				@UserMembershipHandler.getEntity @fakeEntityId, EntityConfigs.group, @user._id, (error, subscription) =>
					should.exist(error)
					done()

		describe 'institutions', ->
			it 'get institution', (done) ->
				@UserMembershipHandler.getEntity @institution.v1Id, EntityConfigs.institution, @user, (error, institution) =>
					should.not.exist(error)
					expectedQuery = v1Id: @institution.v1Id, managerIds: ObjectId(@user._id)
					assertCalledWith(@Institution.findOne, expectedQuery)
					expect(institution).to.equal @institution
					done()

			it 'handle errors', (done) ->
				@Institution.findOne.yields(new Error('nope'))
				@UserMembershipHandler.getEntity @fakeEntityId, EntityConfigs.institution, @user._id, (error, institution) =>
					should.exist(error)
					expect(error).to.not.be.an.instanceof(Errors.NotFoundError)
					done()

	describe 'getUsers', ->
		describe 'group', ->
			it 'build view model for all users', (done) ->
				@UserMembershipHandler.getUsers @subscription, EntityConfigs.group, (error, users) =>
					expectedCallcount =
						@subscription.member_ids.length +
						@subscription.invited_emails.length +
						@subscription.teamInvites.length
					expect(@UserMembershipViewModel.buildAsync.callCount).to.equal expectedCallcount
					done()

		describe 'group mamagers', ->
			it 'build view model for all managers', (done) ->
				@UserMembershipHandler.getUsers @subscription, EntityConfigs.groupManagers, (error, users) =>
					expectedCallcount = @subscription.manager_ids.length
					expect(@UserMembershipViewModel.buildAsync.callCount).to.equal expectedCallcount
					done()

		describe 'institution', ->
			it 'build view model for all managers', (done) ->
				@UserMembershipHandler.getUsers @institution, EntityConfigs.institution, (error, users) =>
					expectedCallcount = @institution.managerIds.length
					expect(@UserMembershipViewModel.buildAsync.callCount).to.equal expectedCallcount
					done()

	describe 'addUser', ->
		beforeEach ->
			@email = @newUser.email

		describe 'institution', ->
			it 'get user', (done) ->
				@UserMembershipHandler.addUser @institution, EntityConfigs.institution, @email, (error, user) =>
					assertCalledWith(@UserGetter.getUserByAnyEmail, @email)
					done()

			it 'handle user not found', (done) ->
				@UserGetter.getUserByAnyEmail.yields(null, null)
				@UserMembershipHandler.addUser @institution, EntityConfigs.institution, @email, (error) =>
					expect(error).to.exist
					expect(error).to.be.an.instanceof(Errors.NotFoundError)
					done()

			it 'add user to institution', (done) ->
				@UserMembershipHandler.addUser @institution, EntityConfigs.institution, @email, (error, user) =>
					assertCalledWith(@institution.update, { $addToSet: managerIds: @newUser._id })
					done()

			it 'return user view', (done) ->
				@UserMembershipHandler.addUser @institution, EntityConfigs.institution, @email, (error, user) =>
					user.should.equal @newUser
					done()

	describe 'removeUser', ->
		describe 'institution', ->
			it 'remove user from institution', (done) ->
				@UserMembershipHandler.removeUser @institution, EntityConfigs.institution, @newUser._id, (error, user) =>
					lastCall = @institution.update.lastCall
					assertCalledWith(@institution.update, { $pull: managerIds: @newUser._id })
					done()
