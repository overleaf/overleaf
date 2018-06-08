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
		@EmailHelper =
			parseEmail: sinon.stub()
		@UserEmailsController = SandboxedModule.require modulePath, requires:
			"../Authentication/AuthenticationController": @AuthenticationController
			"./UserGetter": @UserGetter
			"./UserUpdater": @UserUpdater
			"../Helpers/EmailHelper": @EmailHelper
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

		it 'handles error', (done) ->
			@UserGetter.getUserFullEmails.callsArgWith 1, new Error('Oups')

			@UserEmailsController.list @req, 
				sendStatus: (code) =>
					code.should.equal 500
					done()

	describe 'Add', ->
		beforeEach ->
			@newEmail = 'new_email@baz.com'
			@req.body.email = @newEmail
			@EmailHelper.parseEmail.returns @newEmail

		it 'adds new email', (done) ->
			@UserUpdater.addEmailAddress.callsArgWith 2, null

			@UserEmailsController.add @req, 
				sendStatus: (code) =>
					code.should.equal 200
					assertCalledWith @EmailHelper.parseEmail, @newEmail
					assertCalledWith @UserUpdater.addEmailAddress, @user._id, @newEmail
					done()

		it 'handles email parse error', (done) ->
			@EmailHelper.parseEmail.returns null

			@UserEmailsController.add @req, 
				sendStatus: (code) =>
					code.should.equal 422
					assertNotCalled @UserUpdater.addEmailAddress
					done()

		it 'handles error', (done) ->
			@UserUpdater.addEmailAddress.callsArgWith 2, new Error('Oups')

			@UserEmailsController.add @req, 
				sendStatus: (code) =>
					code.should.equal 500
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

		it 'handles error', (done) ->
			@UserUpdater.removeEmailAddress.callsArgWith 2, new Error('Oups')

			@UserEmailsController.remove @req, 
				sendStatus: (code) =>
					code.should.equal 500
					done()


	describe 'setDefault', ->
		beforeEach ->
			@email = "email_to_set_default@bar.com"
			@req.body.email = @email
			@EmailHelper.parseEmail.returns @email

		it 'sets default email', (done) ->
			@UserUpdater.setDefaultEmailAddress.callsArgWith 2, null

			@UserEmailsController.setDefault @req, 
				sendStatus: (code) =>
					code.should.equal 200
					assertCalledWith @EmailHelper.parseEmail, @email
					assertCalledWith @UserUpdater.setDefaultEmailAddress, @user._id, @email
					done()

		it 'handles email parse error', (done) ->
			@EmailHelper.parseEmail.returns null

			@UserEmailsController.setDefault @req, 
				sendStatus: (code) =>
					code.should.equal 422
					assertNotCalled @UserUpdater.setDefaultEmailAddress
					done()

		it 'handles error', (done) ->
			@UserUpdater.setDefaultEmailAddress.callsArgWith 2, new Error('Oups')

			@UserEmailsController.setDefault @req, 
				sendStatus: (code) =>
					code.should.equal 500
					done()

