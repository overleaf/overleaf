should = require('chai').should()
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

		@res = {}


	describe "requestReset", ->

		it "should error if the rate limit is hit", (done)->
			@PasswordResetHandler.generateAndEmailResetToken.callsArgWith(1)
			@RateLimiter.addCount.callsArgWith(1, null, false)
			@res.send = (code)=>
				code.should.equal 500
				@PasswordResetHandler.generateAndEmailResetToken.calledWith(@email.trim()).should.equal false
				done()
			@PasswordResetController.requestReset @req, @res


		it "should tell the handler to process that email", (done)->
			@RateLimiter.addCount.callsArgWith(1, null, true)
			@PasswordResetHandler.generateAndEmailResetToken.callsArgWith(1)
			@res.send = (code)=>
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

		it "should lowercase the email address", (done)->
			@email = "UPerCaseEMAIL@example.Com"
			@req.body.email = @email
			@RateLimiter.addCount.callsArgWith(1, null, true)
			@PasswordResetHandler.generateAndEmailResetToken.callsArgWith(1)
			@res.send = (code)=>
				code.should.equal 200
				@PasswordResetHandler.generateAndEmailResetToken.calledWith(@email.toLowerCase()).should.equal true
				done()
			@PasswordResetController.requestReset @req, @res

	describe "setNewUserPassword", ->

		it "should tell the user handler to reset the password", (done)->
			@PasswordResetHandler.setNewUserPassword.callsArgWith(2)
			@res.send = (code)=>
				code.should.equal 200
				@PasswordResetHandler.setNewUserPassword.calledWith(@token, @password).should.equal true
				done()
			@PasswordResetController.setNewUserPassword @req, @res

		it "should send a 500 if there is an error", (done)->
			@PasswordResetHandler.setNewUserPassword.callsArgWith(2, "error")
			@res.send = (code)=>
				code.should.equal 500
				done()
			@PasswordResetController.setNewUserPassword @req, @res

		it "should error if there is no password", (done)->
			@req.body.password = ""
			@PasswordResetHandler.setNewUserPassword.callsArgWith(2)
			@res.send = (code)=>
				code.should.equal 500
				@PasswordResetHandler.setNewUserPassword.called.should.equal false
				done()
			@PasswordResetController.setNewUserPassword @req, @res

		it "should error if there is no password", (done)->
			@req.body.passwordResetToken = ""
			@PasswordResetHandler.setNewUserPassword.callsArgWith(2)
			@res.send = (code)=>
				code.should.equal 500
				@PasswordResetHandler.setNewUserPassword.called.should.equal false
				done()
			@PasswordResetController.setNewUserPassword @req, @res



