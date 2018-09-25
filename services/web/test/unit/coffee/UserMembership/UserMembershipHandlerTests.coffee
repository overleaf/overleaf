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

describe 'UserMembershipHandler', ->
	beforeEach ->
		@user = _id: 'mock-user-id'
		@newUser = _id: 'mock-new-user-id', email: 'new-user-email@foo.bar'
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

		@SubscriptionLocator =
			findManagedSubscription: sinon.stub().yields(null, @subscription)
		@InstitutionsLocator =
			findManagedInstitution: sinon.stub().yields(null, @institution)
		@UserMembershipViewModel =
			buildAsync: sinon.stub().yields(null, { _id: 'mock-member-id'})
			build: sinon.stub().returns(@newUser)
		@UserGetter =
			getUserByAnyEmail: sinon.stub().yields(null, @newUser)
		@UserMembershipHandler = SandboxedModule.require modulePath, requires:
			'../Subscription/SubscriptionLocator': @SubscriptionLocator
			'../Institutions/InstitutionsLocator': @InstitutionsLocator
			'./UserMembershipViewModel': @UserMembershipViewModel
			'../User/UserGetter': @UserGetter
			'../Errors/Errors': Errors
			'logger-sharelatex':
				log: -> 
				err: ->

	describe 'getEntty', ->
		it 'validate type', (done) ->
			@UserMembershipHandler.getEntity 'foo', null, (error) ->
				should.exist(error)
				expect(error.message).to.match /No such entity/
				done()

		describe 'group subscriptions', ->
			it 'get subscription', (done) ->
				@UserMembershipHandler.getEntity 'group', @user._id, (error, subscription) =>
					should.not.exist(error)
					assertCalledWith(@SubscriptionLocator.findManagedSubscription, @user._id)
					expect(subscription).to.equal @subscription
					expect(subscription.membersLimit).to.equal 10
					done()

			it 'check subscription is a group', (done) ->
				@SubscriptionLocator.findManagedSubscription.yields(null, { groupPlan: false })
				@UserMembershipHandler.getEntity 'group', @user._id, (error, subscription) ->
					should.exist(error)
					done()

			it 'handle error', (done) ->
				@SubscriptionLocator.findManagedSubscription.yields(new Error('some error'))
				@UserMembershipHandler.getEntity 'group', @user._id, (error, subscription) =>
					should.exist(error)
					done()

		describe 'group managers', ->
			it 'has no members limit', (done) ->
				@UserMembershipHandler.getEntity 'groupManagers', @user._id, (error, subscription) =>
					should.not.exist(error)
					assertCalledWith(@SubscriptionLocator.findManagedSubscription, @user._id)
					expect(subscription.membersLimit).to.equal null
					done()

		describe 'institutions', ->
			it 'get institution', (done) ->
				@UserMembershipHandler.getEntity 'institution', @user._id, (error, institution) =>
					should.not.exist(error)
					assertCalledWith(@InstitutionsLocator.findManagedInstitution, @user._id)
					expect(institution).to.equal @institution
					done()

			it 'handle institution not found', (done) ->
				@InstitutionsLocator.findManagedInstitution.yields(null, null)
				@UserMembershipHandler.getEntity 'institution', @user._id, (error, institution) =>
					should.exist(error)
					expect(error).to.be.an.instanceof(Errors.NotFoundError)
					done()

			it 'handle errors', (done) ->
				@InstitutionsLocator.findManagedInstitution.yields(new Error('nope'))
				@UserMembershipHandler.getEntity 'institution', @user._id, (error, institution) =>
					should.exist(error)
					expect(error).to.not.be.an.instanceof(Errors.NotFoundError)
					done()

	describe 'getUsers', ->
		describe 'group', ->
			it 'build view model for all users', (done) ->
				@UserMembershipHandler.getUsers 'group', @subscription, (error, users) =>
					expectedCallcount =
						@subscription.member_ids.length +
						@subscription.invited_emails.length +
						@subscription.teamInvites.length
					expect(@UserMembershipViewModel.buildAsync.callCount).to.equal expectedCallcount
					done()

		describe 'group mamagers', ->
			it 'build view model for all managers', (done) ->
				@UserMembershipHandler.getUsers 'groupManagers', @subscription, (error, users) =>
					expectedCallcount = @subscription.manager_ids.length
					expect(@UserMembershipViewModel.buildAsync.callCount).to.equal expectedCallcount
					done()

		describe 'institution', ->
			it 'build view model for all managers', (done) ->
				@UserMembershipHandler.getUsers 'institution', @institution, (error, users) =>
					expectedCallcount = @institution.managerIds.length
					expect(@UserMembershipViewModel.buildAsync.callCount).to.equal expectedCallcount
					done()

	describe 'addUser', ->
		beforeEach ->
			@email = @newUser.email

		describe 'group', ->
			it 'fails', (done) ->
				@UserMembershipHandler.addUser 'group', @subscription, @email, (error) =>
					expect(error).to.exist
					done()

		describe 'institution', ->
			it 'get user', (done) ->
				@UserMembershipHandler.addUser 'institution', @institution, @email, (error, user) =>
					assertCalledWith(@UserGetter.getUserByAnyEmail, @email)
					done()

			it 'handle user not found', (done) ->
				@UserGetter.getUserByAnyEmail.yields(null, null)
				@UserMembershipHandler.addUser 'institution', @institution, @email, (error) =>
					expect(error).to.exist
					expect(error).to.be.an.instanceof(Errors.NotFoundError)
					done()

			it 'add user to institution', (done) ->
				@UserMembershipHandler.addUser 'institution', @institution, @email, (error, user) =>
					assertCalledWith(@institution.update, { $addToSet: managerIds: @newUser._id })
					done()

			it 'return user view', (done) ->
				@UserMembershipHandler.addUser 'institution', @institution, @email, (error, user) =>
					user.should.equal @newUser
					done()

	describe 'removeUser', ->
		describe 'institution', ->
			it 'remove user from institution', (done) ->
				@UserMembershipHandler.removeUser 'institution', @institution, @newUser._id, (error, user) =>
					lastCall = @institution.update.lastCall
					assertCalledWith(@institution.update, { $pull: managerIds: @newUser._id })
					done()
