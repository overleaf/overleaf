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
			getEntityWithoutAuthorizationCheck: sinon.stub().yields(null, @subscription)
		@AuthorizationMiddlewear =
			redirectToRestricted: sinon.stub().yields()
			ensureUserIsSiteAdmin: sinon.stub().yields()
		@UserMembershipAuthorization = SandboxedModule.require modulePath, requires:
			'../Authentication/AuthenticationController': @AuthenticationController
			'../Authorization/AuthorizationMiddlewear': @AuthorizationMiddlewear
			'./UserMembershipHandler': @UserMembershipHandler
			'./EntityConfigs': EntityConfigs
			'../Errors/Errors': Errors
			'request': @request = sinon.stub().yields(null, null, {})
			"logger-sharelatex":
				log: ->
				err: ->

	describe 'requireAccessToEntity', ->
		it 'get entity', (done) ->
			@UserMembershipAuthorization.requireGroupAccess @req, null, (error) =>
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

		it 'handle entity not found as non-admin', (done) ->
			@UserMembershipHandler.getEntity.yields(null, null)
			@UserMembershipHandler.getEntityWithoutAuthorizationCheck.yields(null, null)
			@UserMembershipAuthorization.requireGroupAccess @req, null, (error) =>
				expect(error).to.extist
				expect(error).to.be.instanceof(Error)
				expect(error.constructor.name).to.equal('NotFoundError')
				sinon.assert.called(@UserMembershipHandler.getEntity)
				expect(@req.entity).to.not.exist
				done()

		it 'handle entity not found an admin can create', (done) ->
			@user.isAdmin = true
			@UserMembershipHandler.getEntity.yields(null, null)
			@UserMembershipHandler.getEntityWithoutAuthorizationCheck.yields(null, null)
			@UserMembershipAuthorization.requirePublisherAccess @req, redirect: (path) =>
				expect(path).to.extist
				expect(path).to.match /create/
				done()

		it 'handle entity not found an admin cannot create', (done) ->
			@user.isAdmin = true
			@UserMembershipHandler.getEntity.yields(null, null)
			@UserMembershipHandler.getEntityWithoutAuthorizationCheck.yields(null, null)
			@UserMembershipAuthorization.requireGroupAccess @req, null, (error) =>
				expect(error).to.extist
				expect(error).to.be.instanceof(Error)
				expect(error.constructor.name).to.equal('NotFoundError')
				done()

		it 'handle entity no access', (done) ->
			@UserMembershipHandler.getEntity.yields(null, null)
			@UserMembershipAuthorization.requireGroupAccess @req, null, (error) =>
				sinon.assert.called(@AuthorizationMiddlewear.redirectToRestricted)
				done()

		it 'handle anonymous user', (done) ->
			@AuthenticationController.getSessionUser.returns(null)
			@UserMembershipAuthorization.requireGroupAccess @req, null, (error) =>
				expect(error).to.extist
				sinon.assert.called(@AuthorizationMiddlewear.redirectToRestricted)
				sinon.assert.notCalled(@UserMembershipHandler.getEntity)
				expect(@req.entity).to.not.exist
				done()

	describe 'requireEntityAccess', ->
		it 'handle team access', (done) ->
			@UserMembershipAuthorization.requireTeamAccess @req, null, (error) =>
				expect(error).to.not.extist
				sinon.assert.calledWithMatch(
					@UserMembershipHandler.getEntity,
					@req.params.id,
					fields: primaryKey: 'overleaf.id'
				)
				done()

		it 'handle group access', (done) ->
			@UserMembershipAuthorization.requireGroupAccess @req, null, (error) =>
				expect(error).to.not.extist
				sinon.assert.calledWithMatch(
					@UserMembershipHandler.getEntity,
					@req.params.id,
					translations: title: 'group_account'
				)
				done()

		it 'handle group managers access', (done) ->
			@UserMembershipAuthorization.requireGroupManagersAccess @req, null, (error) =>
				expect(error).to.not.extist
				sinon.assert.calledWithMatch(
					@UserMembershipHandler.getEntity,
					@req.params.id,
					translations: subtitle: 'managers_management'
				)
				done()

		it 'handle institution access', (done) ->
			@UserMembershipAuthorization.requireInstitutionAccess @req, null, (error) =>
				expect(error).to.not.extist
				sinon.assert.calledWithMatch(
					@UserMembershipHandler.getEntity,
					@req.params.id,
					modelName: 'Institution',
				)
				done()

		it 'handle template with brand access', (done) ->
			templateData =
				id: 123
				title: 'Template Title'
				brand: { slug: 'brand-slug' }
			@request.yields(null, { statusCode: 200 }, JSON.stringify(templateData))
			@UserMembershipAuthorization.requireTemplateAccess @req, null, (error) =>
				expect(error).to.not.extist
				sinon.assert.calledWithMatch(
					@UserMembershipHandler.getEntity,
					'brand-slug',
					modelName: 'Publisher',
				)
				done()

		it 'handle template without brand access', (done) ->
			templateData =
				id: 123
				title: 'Template Title'
				brand: null
			@request.yields(null, { statusCode: 200 }, JSON.stringify(templateData))
			@UserMembershipAuthorization.requireTemplateAccess @req, null, (error) =>
				expect(error).to.not.extist
				sinon.assert.notCalled(@UserMembershipHandler.getEntity)
				sinon.assert.calledOnce(@AuthorizationMiddlewear.ensureUserIsSiteAdmin)
				done()

		it 'handle graph access', (done) ->
			@req.query.resource_id = 'mock-resource-id'
			@req.query.resource_type = 'institution'
			middlewear = @UserMembershipAuthorization.requireGraphAccess
			middlewear @req, null, (error) =>
				expect(error).to.not.extist
				sinon.assert.calledWithMatch(
					@UserMembershipHandler.getEntity,
					@req.query.resource_id,
					modelName: 'Institution',
				)
				done()
