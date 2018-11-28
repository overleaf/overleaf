sinon = require('sinon')
chai = require('chai')
expect = require('chai').expect
modulePath = "../../../../app/js/Features/UserMembership/UserMembershipAuthorization.js"
SandboxedModule = require('sandboxed-module')
MockRequest = require "../helpers/MockRequest"
EntityConfigs = require("../../../../app/js/Features/UserMembership/UserMembershipEntityConfigs")
Errors = require("../../../../app/js/Features/Errors/Errors")

describe "UserMembershipAuthorization", ->
	beforeEach ->
		@req = new MockRequest()
		@req.params.id = 'mock-entity-id'
		@user = _id: 'mock-user-id'
		@subscription = { _id: 'mock-subscription-id'}

		@AuthenticationController =
			getSessionUser: sinon.stub().returns(@user)
		@UserMembershipHandler =
			getEntity: sinon.stub().yields(null, @subscription)
		@AuthorizationMiddlewear =
			redirectToRestricted: sinon.stub().yields()
		@UserMembershipAuthorization = SandboxedModule.require modulePath, requires:
			'../Authentication/AuthenticationController': @AuthenticationController
			'../Authorization/AuthorizationMiddlewear': @AuthorizationMiddlewear
			'./UserMembershipHandler': @UserMembershipHandler
			'./EntityConfigs': EntityConfigs
			'../Errors/Errors': Errors
			"logger-sharelatex":
				log: ->
				err: ->

	describe 'requireEntityAccess', ->
		it 'get entity', (done) ->
			middlewear = @UserMembershipAuthorization.requireEntityAccess 'group'
			middlewear @req, null, (error) =>
				expect(error).to.not.extist
				sinon.assert.calledWithMatch(
					@UserMembershipHandler.getEntity,
					@req.params.id,
					modelName: 'Subscription',
					@user
				)
				expect(@req.entity).to.equal @subscription
				expect(@req.entityConfig).to.exist
				done()

		it 'handle unknown entity', (done) ->
			middlewear = @UserMembershipAuthorization.requireEntityAccess 'foo'
			middlewear @req, null, (error) =>
				expect(error).to.extist
				expect(error).to.be.an.instanceof(Errors.NotFoundError)
				sinon.assert.notCalled(@UserMembershipHandler.getEntity)
				expect(@req.entity).to.not.exist
				done()

		it 'handle entity not found', (done) ->
			@UserMembershipHandler.getEntity.yields(null, null)
			middlewear = @UserMembershipAuthorization.requireEntityAccess 'institution'
			middlewear @req, null, (error) =>
				expect(error).to.extist
				sinon.assert.called(@AuthorizationMiddlewear.redirectToRestricted)
				sinon.assert.called(@UserMembershipHandler.getEntity)
				expect(@req.entity).to.not.exist
				done()

		it 'handle anonymous user', (done) ->
			@AuthenticationController.getSessionUser.returns(null)
			middlewear = @UserMembershipAuthorization.requireEntityAccess 'institution'
			middlewear @req, null, (error) =>
				expect(error).to.extist
				sinon.assert.called(@AuthorizationMiddlewear.redirectToRestricted)
				sinon.assert.notCalled(@UserMembershipHandler.getEntity)
				expect(@req.entity).to.not.exist
				done()

		it 'can override entity id', (done) ->
			middlewear = @UserMembershipAuthorization.requireEntityAccess 'group', 'entity-id-override'
			middlewear @req, null, (error) =>
				expect(error).to.not.extist
				sinon.assert.calledWithMatch(
					@UserMembershipHandler.getEntity,
					'entity-id-override',
				)
				done()

		it "doesn't cache entity id between requests", (done) ->
			middlewear = @UserMembershipAuthorization.requireEntityAccess 'group'
			middlewear @req, null, (error) =>
				expect(error).to.not.extist
				lastCallArs = @UserMembershipHandler.getEntity.lastCall.args
				expect(lastCallArs[0]).to.equal @req.params.id
				newEntityId = 'another-mock-id'
				@req.params.id = newEntityId
				middlewear @req, null, (error) =>
					expect(error).to.not.extist
					lastCallArs = @UserMembershipHandler.getEntity.lastCall.args
					expect(lastCallArs[0]).to.equal newEntityId
					done()
