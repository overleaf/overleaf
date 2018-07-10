sinon = require('sinon')
assertCalledWith = sinon.assert.calledWith
assertNotCalled = sinon.assert.notCalled
chai = require('chai')
should = chai.should()
assert = chai.assert
modulePath = "../../../../app/js/Features/User/UserEmailsController.js"
SandboxedModule = require('sandboxed-module')
MockRequest = require "../helpers/MockRequest"
MockResponse = require "../helpers/MockResponse"
Errors = require("../../../../app/js/Features/Errors/Errors")

describe "UserEmailsController", ->
	beforeEach ->
		@req = new MockRequest()
		@user =
			_id: 'mock-user-id'

		@UserGetter =
			getUserFullEmails: sinon.stub()
		@AuthenticationController =
			getLoggedInUserId: sinon.stub().returns(@user._id)
		@UserUpdater =
			addEmailAddress: sinon.stub()
			removeEmailAddress: sinon.stub()
			setDefaultEmailAddress: sinon.stub()
			updateV1AndSetDefaultEmailAddress: sinon.stub()
		@EmailHelper =
			parseEmail: sinon.stub()
		@endorseAffiliation = sinon.stub().yields()
		@UserEmailsController = SandboxedModule.require modulePath, requires:
			"../Authentication/AuthenticationController": @AuthenticationController
			"./UserGetter": @UserGetter
			"./UserUpdater": @UserUpdater
			"../Helpers/EmailHelper": @EmailHelper
			"./UserEmailsConfirmationHandler": @UserEmailsConfirmationHandler = {}
			"../Institutions/InstitutionsAPI": endorseAffiliation: @endorseAffiliation
			"../Errors/Errors": Errors
			"logger-sharelatex":
				log: -> console.log(arguments)
				err: ->

	describe 'List', ->
		beforeEach ->

		it 'lists emails', (done) ->
			fullEmails = [{some: 'data'}]
			@UserGetter.getUserFullEmails.callsArgWith 1, null, fullEmails

			@UserEmailsController.list @req, 
				json: (response) =>
					assert.deepEqual response, fullEmails
					assertCalledWith @UserGetter.getUserFullEmails, @user._id
					done()

	describe 'Add', ->
		beforeEach ->
			@newEmail = 'new_email@baz.com'
			@req.body =
				email: @newEmail
				university: { name: 'University Name' }
				department: 'Department'
				role: 'Role'
			@EmailHelper.parseEmail.returns @newEmail
			@UserEmailsConfirmationHandler.sendConfirmationEmail = sinon.stub().yields()
			@UserUpdater.addEmailAddress.callsArgWith 3, null

		it 'adds new email', (done) ->
			@UserEmailsController.add @req, 
				sendStatus: (code) =>
					code.should.equal 204
					assertCalledWith @EmailHelper.parseEmail, @newEmail
					assertCalledWith @UserUpdater.addEmailAddress, @user._id, @newEmail

					affiliationOptions = @UserUpdater.addEmailAddress.lastCall.args[2]
					Object.keys(affiliationOptions).length.should.equal 3
					affiliationOptions.university.should.equal @req.body.university
					affiliationOptions.department.should.equal @req.body.department
					affiliationOptions.role.should.equal @req.body.role

					done()

		it 'sends an email confirmation', (done) ->
			@UserEmailsController.add @req, 
				sendStatus: (code) =>
					code.should.equal 204
					assertCalledWith @UserEmailsConfirmationHandler.sendConfirmationEmail, @user._id, @newEmail
					done()

		it 'handles email parse error', (done) ->
			@EmailHelper.parseEmail.returns null
			@UserEmailsController.add @req, 
				sendStatus: (code) =>
					code.should.equal 422
					assertNotCalled @UserUpdater.addEmailAddress
					done()

	describe 'remove', ->
		beforeEach ->
			@email = 'email_to_remove@bar.com'
			@req.body.email = @email
			@EmailHelper.parseEmail.returns @email

		it 'removes email', (done) ->
			@UserUpdater.removeEmailAddress.callsArgWith 2, null

			@UserEmailsController.remove @req, 
				sendStatus: (code) =>
					code.should.equal 200
					assertCalledWith @EmailHelper.parseEmail, @email
					assertCalledWith @UserUpdater.removeEmailAddress, @user._id, @email
					done()

		it 'handles email parse error', (done) ->
			@EmailHelper.parseEmail.returns null

			@UserEmailsController.remove @req, 
				sendStatus: (code) =>
					code.should.equal 422
					assertNotCalled @UserUpdater.removeEmailAddress
					done()

	describe 'setDefault', ->
		beforeEach ->
			@email = "email_to_set_default@bar.com"
			@req.body.email = @email
			@EmailHelper.parseEmail.returns @email

		it 'sets default email', (done) ->
			@UserUpdater.updateV1AndSetDefaultEmailAddress.callsArgWith 2, null

			@UserEmailsController.setDefault @req, 
				sendStatus: (code) =>
					code.should.equal 200
					assertCalledWith @EmailHelper.parseEmail, @email
					assertCalledWith @UserUpdater.updateV1AndSetDefaultEmailAddress, @user._id, @email
					done()

		it 'handles email parse error', (done) ->
			@EmailHelper.parseEmail.returns null

			@UserEmailsController.setDefault @req, 
				sendStatus: (code) =>
					code.should.equal 422
					assertNotCalled @UserUpdater.setDefaultEmailAddress
					done()

	describe 'endorse', ->
		beforeEach ->
			@email = 'email_to_endorse@bar.com'
			@req.body.email = @email
			@EmailHelper.parseEmail.returns @email

		it 'endorses affiliation', (done) ->
			@req.body.role = 'Role'
			@req.body.department = 'Department'

			@UserEmailsController.endorse @req,
				sendStatus: (code) =>
					code.should.equal 204
					assertCalledWith @endorseAffiliation, @user._id, @email, 'Role', 'Department'
					done()

	describe 'confirm', ->
		beforeEach ->
			@UserEmailsConfirmationHandler.confirmEmailFromToken = sinon.stub().yields()
			@res =
				sendStatus: sinon.stub()
				json: sinon.stub()
			@res.status = sinon.stub().returns(@res)
			@next = sinon.stub()
			@token = 'mock-token'
			@req.body = token: @token

		describe 'successfully', ->
			beforeEach ->
				@UserEmailsController.confirm @req, @res, @next

			it 'should confirm the email from the token', ->
				@UserEmailsConfirmationHandler.confirmEmailFromToken
					.calledWith(@token)
					.should.equal true

			it 'should return a 200 status', ->
				@res.sendStatus.calledWith(200).should.equal true

		describe 'without a token', ->
			beforeEach ->
				@req.body.token = null
				@UserEmailsController.confirm @req, @res, @next

			it 'should return a 422 status', ->
				@res.sendStatus.calledWith(422).should.equal true

		describe 'when confirming fails', ->
			beforeEach ->
				@UserEmailsConfirmationHandler.confirmEmailFromToken = sinon.stub().yields(
					new Errors.NotFoundError('not found')
				)
				@UserEmailsController.confirm @req, @res, @next

			it 'should return a 404 error code with a message', ->
				@res.status.calledWith(404).should.equal true
				@res.json.calledWith({
					message: 'Sorry, your confirmation token is invalid or has expired. Please request a new email confirmation link.'
				}).should.equal true




