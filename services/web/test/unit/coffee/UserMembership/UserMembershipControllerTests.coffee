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

describe "UserMembershipController", ->
	beforeEach ->
		@req = new MockRequest()
		@user = _id: 'mock-user-id'
		@newUser = _id: 'mock-new-user-id', email: 'new-user-email@foo.bar'
		@subscription = { _id: 'mock-subscription-id'}
		@users = [{ _id: 'mock-member-id-1' }, { _id: 'mock-member-id-2' }]

		@AuthenticationController =
			getLoggedInUserId: sinon.stub().returns(@user._id)
		@UserMembershipHandler =
			getEntity: sinon.stub().yields(null, @subscription)
			getUsers: sinon.stub().yields(null, @users)
			addUser: sinon.stub().yields(null, @newUser)
			removeUser: sinon.stub().yields(null)
		@UserMembershipController = SandboxedModule.require modulePath, requires:
			'../Authentication/AuthenticationController': @AuthenticationController
			'./UserMembershipHandler': @UserMembershipHandler
			"logger-sharelatex":
				log: -> 
				err: ->

	describe 'index', ->
		it 'get entity', (done) ->
			@UserMembershipController.index 'group', @req, render: () =>
				sinon.assert.calledWith(@UserMembershipHandler.getEntity, 'group', @user._id)
				done()

		it 'get users', (done) ->
			@UserMembershipController.index 'group', @req, render: () =>
				sinon.assert.calledWith(@UserMembershipHandler.getUsers, 'group', @subscription)
				done()

		it 'render group view', (done) ->
			@UserMembershipController.index 'group', @req, render: (viewPath, viewParams) =>
				expect(viewPath).to.equal 'user_membership/index'
				expect(viewParams.entity).to.deep.equal @subscription
				expect(viewParams.users).to.deep.equal @users
				expect(viewParams.translations.title).to.equal 'group_account'
				expect(viewParams.paths.addMember).to.equal '/subscription/invites'
				done()

		it 'render group managers view', (done) ->
			@UserMembershipController.index 'groupManagers', @req, render: (viewPath, viewParams) =>
				expect(viewPath).to.equal 'user_membership/index'
				expect(viewParams.translations.title).to.equal 'group_managers'
				expect(viewParams.paths.exportMembers).to.be.undefined
				done()

		it 'render institution view', (done) ->
			@UserMembershipController.index 'institution', @req, render: (viewPath, viewParams) =>
				expect(viewPath).to.equal 'user_membership/index'
				expect(viewParams.translations.title).to.equal 'institution_managers'
				expect(viewParams.paths.exportMembers).to.be.undefined
				done()

	describe 'add', ->
		beforeEach ->
			@req.body.email = @newUser.email

		it 'get entity', (done) ->
			@UserMembershipController.add 'groupManagers', @req, json: () =>
				sinon.assert.calledWith(@UserMembershipHandler.getEntity, 'groupManagers', @user._id)
				done()

		it 'add user', (done) ->
			@UserMembershipController.add 'groupManagers', @req, json: () =>
				sinon.assert.calledWith(@UserMembershipHandler.addUser, 'groupManagers', @subscription, @newUser.email)
				done()

		it 'return user object', (done) ->
			@UserMembershipController.add 'groupManagers', @req, json: (payload) =>
				payload.user.should.equal @newUser
				done()

	describe 'remove', ->
		beforeEach ->
			@req.params.userId = @newUser._id

		it 'remove user', (done) ->
			@UserMembershipController.remove 'groupManagers', @req, send: () =>
				sinon.assert.calledWith(@UserMembershipHandler.removeUser, 'groupManagers', @subscription, @newUser._id)
				done()
