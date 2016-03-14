should = require('chai').should()
expect = require("chai").expect
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/PasswordReset/PasswordResetController"
expect = require("chai").expect

describe "PasswordResetController", ->

	beforeEach ->

		@settings = {}
		@PasswordResetHandler =
			generateAndEmailResetToken:sinon.stub()
			setNewUserPassword:sinon.stub()
		@RateLimiter =
			addCount: sinon.stub()
		@PasswordResetController = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"./PasswordResetHandler":@PasswordResetHandler
			"logger-sharelatex": log:->
			"../../infrastructure/RateLimiter":@RateLimiter
			"../Authentication/AuthenticationController": @AuthenticationController = {}
			"../User/UserGetter": @UserGetter = {}

		@email = "bob@bob.com "
		@token = "my security token that was emailed to me"
		@password = "my new password"
		@req =
			body:
				email:@email
				passwordResetToken:@token
				password:@password
			i18n:
				translate:->
			session: {}
			query: {}

		@res = {}


	describe "requestReset", ->

		it "should error if the rate limit is hit", (done)->
			@PasswordResetHandler.generateAndEmailResetToken.callsArgWith(1, null, true)
			@RateLimiter.addCount.callsArgWith(1, null, false)
			@res.send = (code)=>
				code.should.equal 500
				@PasswordResetHandler.generateAndEmailResetToken.calledWith(@email.trim()).should.equal false
				done()
			@PasswordResetController.requestReset @req, @res


		it "should tell the handler to process that email", (done)->
			@RateLimiter.addCount.callsArgWith(1, null, true)
			@PasswordResetHandler.generateAndEmailResetToken.callsArgWith(1, null, true)
			@res.sendStatus = (code)=>
				code.should.equal 200
				@PasswordResetHandler.generateAndEmailResetToken.calledWith(@email.trim()).should.equal true
				done()
			@PasswordResetController.requestReset @req, @res

		it "should send a 500 if there is an error", (done)->
			@RateLimiter.addCount.callsArgWith(1, null, true)
			@PasswordResetHandler.generateAndEmailResetToken.callsArgWith(1, "error")
			@res.send = (code)=>
				code.should.equal 500
				done()
			@PasswordResetController.requestReset @req, @res

		it "should send a 404 if the email doesn't exist", (done)->
			@RateLimiter.addCount.callsArgWith(1, null, true)
			@PasswordResetHandler.generateAndEmailResetToken.callsArgWith(1, null, false)
			@res.send = (code)=>
				code.should.equal 404
				done()
			@PasswordResetController.requestReset @req, @res

		it "should lowercase the email address", (done)->
			@email = "UPerCaseEMAIL@example.Com"
			@req.body.email = @email
			@RateLimiter.addCount.callsArgWith(1, null, true)
			@PasswordResetHandler.generateAndEmailResetToken.callsArgWith(1, null, true)
			@res.sendStatus = (code)=>
				code.should.equal 200
				@PasswordResetHandler.generateAndEmailResetToken.calledWith(@email.toLowerCase()).should.equal true
				done()
			@PasswordResetController.requestReset @req, @res

	describe "setNewUserPassword", ->

		beforeEach ->
			@req.session.resetToken = @token

		it "should tell the user handler to reset the password", (done)->
			@PasswordResetHandler.setNewUserPassword.callsArgWith(2, null, true)
			@res.sendStatus = (code)=>
				code.should.equal 200
				@PasswordResetHandler.setNewUserPassword.calledWith(@token, @password).should.equal true
				done()
			@PasswordResetController.setNewUserPassword @req, @res

		it "should send 404 if the token didn't work", (done)->
			@PasswordResetHandler.setNewUserPassword.callsArgWith(2, null, false)
			@res.sendStatus = (code)=>
				code.should.equal 404
				done()
			@PasswordResetController.setNewUserPassword @req, @res

		it "should return 400 (Bad Request) if there is no password", (done)->
			@req.body.password = ""
			@PasswordResetHandler.setNewUserPassword.callsArgWith(2)
			@res.sendStatus = (code)=>
				code.should.equal 400
				@PasswordResetHandler.setNewUserPassword.called.should.equal false
				done()
			@PasswordResetController.setNewUserPassword @req, @res

		it "should return 400 (Bad Request) if there is no passwordResetToken", (done)->
			@req.body.passwordResetToken = ""
			@PasswordResetHandler.setNewUserPassword.callsArgWith(2)
			@res.sendStatus = (code)=>
				code.should.equal 400
				@PasswordResetHandler.setNewUserPassword.called.should.equal false
				done()
			@PasswordResetController.setNewUserPassword @req, @res

		it "should clear the session.resetToken", (done) ->
			@PasswordResetHandler.setNewUserPassword.callsArgWith(2, null, true)
			@res.sendStatus = (code)=>
				code.should.equal 200
				@req.session.should.not.have.property 'resetToken'
				done()
			@PasswordResetController.setNewUserPassword @req, @res
		
		it "should login user if login_after is set", (done) ->
			@UserGetter.getUser = sinon.stub().callsArgWith(2, null, { email: "joe@example.com" })
			@PasswordResetHandler.setNewUserPassword.callsArgWith(2, null, true, @user_id = "user-id-123")
			@req.body.login_after = "true"
			@AuthenticationController.doLogin = (options, req, res, next)=>
				@UserGetter.getUser.calledWith(@user_id).should.equal true
				expect(options).to.deep.equal {
					email: "joe@example.com",
					password: @password
				}
				done()
			@PasswordResetController.setNewUserPassword @req, @res

	describe "renderSetPasswordForm", ->

		describe "with token in query-string", ->
			beforeEach ->
				@req.query.passwordResetToken = @token

			it "should set session.resetToken and redirect", (done) ->
				@req.session.should.not.have.property 'resetToken'
				@res.redirect = (path) =>
					path.should.equal '/user/password/set'
					@req.session.resetToken.should.equal @token
					done()
				@PasswordResetController.renderSetPasswordForm(@req, @res)

		describe "without a token in query-string", ->

			describe "with token in session", ->
				beforeEach ->
					@req.session.resetToken = @token

				it "should render the page, passing the reset token", (done) ->
					@res.render = (template_path, options) =>
						options.passwordResetToken.should.equal @req.session.resetToken
						done()
					@PasswordResetController.renderSetPasswordForm(@req, @res)

			describe "without a token in session", ->

				it "should redirect to the reset request page", (done) ->
					@res.redirect = (path) =>
						path.should.equal "/user/password/reset"
						@req.session.should.not.have.property 'resetToken'
						done()
					@PasswordResetController.renderSetPasswordForm(@req, @res)
