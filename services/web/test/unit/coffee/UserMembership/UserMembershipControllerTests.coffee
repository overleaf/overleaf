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
		@institution = _id: 'mock-institution-id', v1Id: 123
		@users = [
			{ _id: 'mock-member-id-1', email: 'mock-email-1@foo.com' }
			{ _id: 'mock-member-id-2', email: 'mock-email-2@foo.com' }
		]

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
		beforeEach ->
			@req.entity = @subscription
			@req.entityConfig = EntityConfigs.group

		it 'get users', (done) ->
			@UserMembershipController.index @req, render: () =>
				sinon.assert.calledWithMatch(
					@UserMembershipHandler.getUsers,
					@subscription,
					modelName: 'Subscription',
				)
				done()

		it 'render group view', (done) ->
			@UserMembershipController.index @req, render: (viewPath, viewParams) =>
				expect(viewPath).to.equal 'user_membership/index'
				expect(viewParams.users).to.deep.equal @users
				expect(viewParams.groupSize).to.equal @subscription.membersLimit
				expect(viewParams.translations.title).to.equal 'group_account'
				expect(viewParams.paths.addMember).to.equal "/manage/groups/#{@subscription._id}/invites"
				done()

		it 'render group managers view', (done) ->
			@req.entityConfig = EntityConfigs.groupManagers
			@UserMembershipController.index @req, render: (viewPath, viewParams) =>
				expect(viewPath).to.equal 'user_membership/index'
				expect(viewParams.groupSize).to.equal undefined
				expect(viewParams.translations.title).to.equal 'group_managers'
				expect(viewParams.paths.exportMembers).to.be.undefined
				done()

		it 'render institution view', (done) ->
			@req.entity = @institution
			@req.entityConfig = EntityConfigs.institution
			@UserMembershipController.index @req, render: (viewPath, viewParams) =>
				expect(viewPath).to.equal 'user_membership/index'
				expect(viewParams.groupSize).to.equal undefined
				expect(viewParams.translations.title).to.equal 'institution_managers'
				expect(viewParams.paths.exportMembers).to.be.undefined
				done()

	describe 'add', ->
		beforeEach ->
			@req.body.email = @newUser.email
			@req.entity = @subscription
			@req.entityConfig = EntityConfigs.groupManagers

		it 'add user', (done) ->
			@UserMembershipController.add @req, json: () =>
				sinon.assert.calledWithMatch(
					@UserMembershipHandler.addUser,
					@subscription,
					modelName: 'Subscription',
					@newUser.email
				)
				done()

		it 'return user object', (done) ->
			@UserMembershipController.add @req, json: (payload) =>
				payload.user.should.equal @newUser
				done()

		it 'handle readOnly entity', (done) ->
			@req.entityConfig = EntityConfigs.group
			@UserMembershipController.add @req, null, (error) =>
				expect(error).to.extist
				expect(error).to.be.an.instanceof(Errors.NotFoundError)
				done()

	describe 'remove', ->
		beforeEach ->
			@req.params.userId = @newUser._id
			@req.entity = @subscription
			@req.entityConfig = EntityConfigs.groupManagers

		it 'remove user', (done) ->
			@UserMembershipController.remove @req, send: () =>
				sinon.assert.calledWithMatch(
					@UserMembershipHandler.removeUser,
					@subscription,
					modelName: 'Subscription',
					@newUser._id
				)
				done()

		it 'handle readOnly entity', (done) ->
			@req.entityConfig = EntityConfigs.group
			@UserMembershipController.remove @req, null, (error) =>
				expect(error).to.extist
				expect(error).to.be.an.instanceof(Errors.NotFoundError)
				done()

	describe "exportCsv", ->

		beforeEach ->
			@req.entity = @subscription
			@req.entityConfig = EntityConfigs.groupManagers
			@res = new MockResponse()
			@res.contentType = sinon.stub()
			@res.header = sinon.stub()
			@res.send = sinon.stub()
			@UserMembershipController.exportCsv @req, @res

		it 'get users', ->
			sinon.assert.calledWithMatch(
				@UserMembershipHandler.getUsers,
				@subscription,
				modelName: 'Subscription',
			)

		it "should set the correct content type on the request", ->
			assertCalledWith(@res.contentType, "text/csv")

		it "should name the exported csv file", ->
			assertCalledWith(
				@res.header
				"Content-Disposition",
				"attachment; filename=Group.csv"
			)

		it "should export the correct csv", ->
			assertCalledWith(@res.send, "mock-email-1@foo.com\nmock-email-2@foo.com\n")
