sinon = require('sinon')
assertCalledWith = sinon.assert.calledWith
assertNotCalled = sinon.assert.notCalled
chai = require('chai')
should = chai.should()
assert = chai.assert
expect = require('chai').expect
modulePath = "../../../../app/js/Features/UserMembership/UserMembershipController.js"
SandboxedModule = require('sandboxed-module')
MockRequest = require "../helpers/MockRequest"
MockResponse = require "../helpers/MockResponse"
EntityConfigs = require("../../../../app/js/Features/UserMembership/UserMembershipEntityConfigs")
Errors = require("../../../../app/js/Features/Errors/Errors")

describe "UserMembershipController", ->
	beforeEach ->
		@req = new MockRequest()
		@req.params.id = 'mock-entity-id'
		@user = _id: 'mock-user-id'
		@newUser = _id: 'mock-new-user-id', email: 'new-user-email@foo.bar'
		@subscription = { _id: 'mock-subscription-id'}
		@users = [{ _id: 'mock-member-id-1' }, { _id: 'mock-member-id-2' }]

		@AuthenticationController =
			getSessionUser: sinon.stub().returns(@user)
		@UserMembershipHandler =
			getEntity: sinon.stub().yields(null, @subscription)
			getUsers: sinon.stub().yields(null, @users)
			addUser: sinon.stub().yields(null, @newUser)
			removeUser: sinon.stub().yields(null)
		@UserMembershipController = SandboxedModule.require modulePath, requires:
			'../Authentication/AuthenticationController': @AuthenticationController
			'./UserMembershipHandler': @UserMembershipHandler
			'../Errors/Errors': Errors
			"logger-sharelatex":
				log: -> 
				err: ->

	describe 'index', ->
		it 'get entity', (done) ->
			@UserMembershipController.index 'group', @req, render: () =>
				sinon.assert.calledWithMatch(
					@UserMembershipHandler.getEntity,
					@req.params.id,
					modelName: 'Subscription',
					@user
				)
				done()

		it 'get users', (done) ->
			@UserMembershipController.index 'group', @req, render: () =>
				sinon.assert.calledWithMatch(
					@UserMembershipHandler.getUsers,
					@subscription,
					modelName: 'Subscription',
				)
				done()

		it 'render group view', (done) ->
			@UserMembershipController.index 'group', @req, render: (viewPath, viewParams) =>
				expect(viewPath).to.equal 'user_membership/index'
				expect(viewParams.users).to.deep.equal @users
				expect(viewParams.groupSize).to.equal @subscription.membersLimit
				expect(viewParams.translations.title).to.equal 'group_account'
				expect(viewParams.paths.addMember).to.equal '/subscription/invites'
				done()

		it 'render group managers view', (done) ->
			@UserMembershipController.index 'groupManagers', @req, render: (viewPath, viewParams) =>
				expect(viewPath).to.equal 'user_membership/index'
				expect(viewParams.groupSize).to.equal undefined
				expect(viewParams.translations.title).to.equal 'group_managers'
				expect(viewParams.paths.exportMembers).to.be.undefined
				done()

		it 'render institution view', (done) ->
			@UserMembershipController.index 'institution', @req, render: (viewPath, viewParams) =>
				expect(viewPath).to.equal 'user_membership/index'
				expect(viewParams.groupSize).to.equal undefined
				expect(viewParams.translations.title).to.equal 'institution_managers'
				expect(viewParams.paths.exportMembers).to.be.undefined
				done()

		it 'handle unknown entity', (done) ->
			@UserMembershipController.index 'foo', @req, null, (error) =>
				expect(error).to.extist
				expect(error).to.be.an.instanceof(Errors.NotFoundError)
				done()


		it 'handle entity not found', (done) ->
			@UserMembershipHandler.getEntity.yields(null, null)
			@UserMembershipController.index 'group', @req, null, (error) =>
				expect(error).to.extist
				expect(error).to.be.an.instanceof(Errors.NotFoundError)
				done()

	describe 'add', ->
		beforeEach ->
			@req.body.email = @newUser.email

		it 'get entity', (done) ->
			@UserMembershipController.add 'groupManagers', @req, json: () =>
				sinon.assert.calledWithMatch(
					@UserMembershipHandler.getEntity,
					@req.params.id,
					modelName: 'Subscription',
					@user
				)
				done()

		it 'add user', (done) ->
			@UserMembershipController.add 'groupManagers', @req, json: () =>
				sinon.assert.calledWithMatch(
					@UserMembershipHandler.addUser,
					@subscription,
					modelName: 'Subscription',
					@newUser.email
				)
				done()

		it 'return user object', (done) ->
			@UserMembershipController.add 'groupManagers', @req, json: (payload) =>
				payload.user.should.equal @newUser
				done()

		it 'handle readOnly entity', (done) ->
			@UserMembershipController.add 'group', @req, null, (error) =>
				expect(error).to.extist
				expect(error).to.be.an.instanceof(Errors.NotFoundError)
				done()

	describe 'remove', ->
		beforeEach ->
			@req.params.userId = @newUser._id

		it 'remove user', (done) ->
			@UserMembershipController.remove 'groupManagers', @req, send: () =>
				sinon.assert.calledWithMatch(
					@UserMembershipHandler.removeUser,
					@subscription,
					modelName: 'Subscription',
					@newUser._id
				)
				done()

		it 'handle readOnly entity', (done) ->
			@UserMembershipController.remove 'group', @req, null, (error) =>
				expect(error).to.extist
				expect(error).to.be.an.instanceof(Errors.NotFoundError)
				done()
