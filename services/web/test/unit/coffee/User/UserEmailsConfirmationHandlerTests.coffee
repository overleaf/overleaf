should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/User/UserEmailsConfirmationHandler"
expect = require("chai").expect
Errors = require "../../../../app/js/Features/Errors/Errors"
EmailHelper = require "../../../../app/js/Features/Helpers/EmailHelper"

describe "UserEmailsConfirmationHandler", ->
	beforeEach ->
		@UserEmailsConfirmationHandler = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @settings =
				siteUrl: "emails.example.com"
			"logger-sharelatex": @logger = { log: sinon.stub() }
			"../Security/OneTimeTokenHandler": @OneTimeTokenHandler = {}
			"../Errors/Errors": Errors
			"./UserUpdater": @UserUpdater = {}
			"../Email/EmailHandler": @EmailHandler = {}
			"../Helpers/EmailHelper": EmailHelper
		@user_id = "mock-user-id"
		@email = "mock@example.com"
		@callback = sinon.stub()

	describe "sendConfirmationEmail", ->
		beforeEach ->
			@OneTimeTokenHandler.getNewToken = sinon.stub().yields(null, @token = "new-token")
			@EmailHandler.sendEmail = sinon.stub().yields()

		describe 'successfully', ->
			beforeEach ->
				@UserEmailsConfirmationHandler.sendConfirmationEmail @user_id, @email, @callback

			it "should generate a token for the user which references their id and email", ->
				@OneTimeTokenHandler.getNewToken
					.calledWith(
						'email_confirmation',
						JSON.stringify({@user_id, @email}),
						{ expiresIn: 365 * 24 * 60 * 60 }
					)
					.should.equal true

			it 'should send an email to the user', ->
				@EmailHandler.sendEmail
					.calledWith('confirmEmail', {
						to: @email,
						confirmEmailUrl: 'emails.example.com/user/emails/confirm?token=new-token'
					})
					.should.equal true

			it 'should call the callback', ->
				@callback.called.should.equal true

		describe 'with invalid email', ->
			beforeEach ->
				@UserEmailsConfirmationHandler.sendConfirmationEmail @user_id, '!"£$%^&*()', @callback

			it 'should return an error', ->
				@callback.calledWith(sinon.match.instanceOf(Error)).should.equal true

		describe 'a custom template', ->
			beforeEach ->
				@UserEmailsConfirmationHandler.sendConfirmationEmail @user_id, @email, 'myCustomTemplate', @callback

			it 'should send an email with the given template', ->
				@EmailHandler.sendEmail
					.calledWith('myCustomTemplate')
					.should.equal true

	describe "confirmEmailFromToken", ->
		beforeEach ->
			@OneTimeTokenHandler.getValueFromTokenAndExpire = sinon.stub().yields(
				null, 
				JSON.stringify({@user_id, @email})
			)
			@UserUpdater.confirmEmail = sinon.stub().yields()

		describe "successfully", ->
			beforeEach ->
				@UserEmailsConfirmationHandler.confirmEmailFromToken @token = 'mock-token', @callback

			it "should call getValueFromTokenAndExpire", ->
				@OneTimeTokenHandler.getValueFromTokenAndExpire
					.calledWith('email_confirmation', @token)
					.should.equal true

			it "should confirm the email of the user_id", ->
				@UserUpdater.confirmEmail
					.calledWith(@user_id, @email)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe 'with an expired token', ->
			beforeEach ->
				@OneTimeTokenHandler.getValueFromTokenAndExpire = sinon.stub().yields(null, null)
				@UserEmailsConfirmationHandler.confirmEmailFromToken @token = 'mock-token', @callback

			it "should call the callback with a NotFoundError", ->
				@callback.calledWith(sinon.match.instanceOf(Errors.NotFoundError)).should.equal true

		describe 'with no user_id in the token', ->
			beforeEach ->
				@OneTimeTokenHandler.getValueFromTokenAndExpire = sinon.stub().yields(
					null, 
					JSON.stringify({@email})
				)
				@UserEmailsConfirmationHandler.confirmEmailFromToken @token = 'mock-token', @callback

			it "should call the callback with a NotFoundError", ->
				@callback.calledWith(sinon.match.instanceOf(Errors.NotFoundError)).should.equal true

		describe 'with no email in the token', ->
			beforeEach ->
				@OneTimeTokenHandler.getValueFromTokenAndExpire = sinon.stub().yields(
					null, 
					JSON.stringify({@user_id})
				)
				@UserEmailsConfirmationHandler.confirmEmailFromToken @token = 'mock-token', @callback

			it "should call the callback with a NotFoundError", ->
				@callback.calledWith(sinon.match.instanceOf(Errors.NotFoundError)).should.equal true

