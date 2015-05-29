sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/User/UserController.js"
SandboxedModule = require('sandboxed-module')
events = require "events"
MockResponse = require "../helpers/MockResponse"
MockRequest = require "../helpers/MockRequest"
ObjectId = require("mongojs").ObjectId
assert = require("assert")

describe "UserController", ->
	beforeEach ->
		@user_id = "323123"

		@user =
			_id:@user_id
			save:sinon.stub().callsArgWith(0)
			ace:{}

		@UserDeleter = 
			deleteUser: sinon.stub().callsArgWith(1)
		@UserLocator = 
			findById: sinon.stub().callsArgWith(1, null, @user)
		@User =
			findById: sinon.stub().callsArgWith(1, null, @user)
		@NewsLetterManager =
			unsubscribe: sinon.stub().callsArgWith(1)
		@UserRegistrationHandler =
			registerNewUser: sinon.stub()
		@AuthenticationController =
			establishUserSession: sinon.stub().callsArg(2)
		@AuthenticationManager =
			authenticate: sinon.stub()
			setUserPassword: sinon.stub()
		@ReferalAllocator =
			allocate:sinon.stub()
		@SubscriptionDomainHandler = 
			autoAllocate:sinon.stub()
		@UserUpdater =
			changeEmailAddress:sinon.stub()
		@EmailHandler =
			sendEmail:sinon.stub().callsArgWith(2)
		@OneTimeTokenHandler =
			getNewToken: sinon.stub()
		@settings =
			siteUrl: "sharelatex.example.com"
		@UserController = SandboxedModule.require modulePath, requires:
			"./UserLocator": @UserLocator
			"./UserDeleter": @UserDeleter
			"./UserUpdater":@UserUpdater
			"../../models/User": User:@User
			'../Newsletter/NewsletterManager':@NewsLetterManager
			"./UserRegistrationHandler":@UserRegistrationHandler
			"../Authentication/AuthenticationController": @AuthenticationController
			"../Authentication/AuthenticationManager": @AuthenticationManager
			"../Referal/ReferalAllocator":@ReferalAllocator
			"../Subscription/SubscriptionDomainHandler":@SubscriptionDomainHandler
			"../Email/EmailHandler": @EmailHandler
			"../Security/OneTimeTokenHandler": @OneTimeTokenHandler
			"crypto": @crypto = {}
			"settings-sharelatex": @settings
			"logger-sharelatex": {log:->}


		@req = 
			session: 
				destroy:->
				user :
					_id : @user_id
			body:{}
		@res =
			send: sinon.stub()
			json: sinon.stub()
		@next = sinon.stub()
	describe "deleteUser", ->

		it "should delete the user", (done)->

			@res.send = (code)=>
				@UserDeleter.deleteUser.calledWith(@user_id)
				code.should.equal 200
				done()
			@UserController.deleteUser @req, @res

	describe "unsubscribe", ->

		it "should send the user to unsubscribe", (done)->
			@res.send = (code)=>
				@NewsLetterManager.unsubscribe.calledWith(@user).should.equal true
				done()
			@UserController.unsubscribe @req, @res

	describe "updateUserSettings", ->
		beforeEach ->
			@newEmail = "hello@world.com"

		it "should call save", (done)->
			@req.body = {}
			@res.send = (code)=>
				@user.save.called.should.equal true
				done()
			@UserController.updateUserSettings @req, @res

		it "should set the first name", (done)->
			@req.body =
				first_name: "bobby  "
			@res.send = (code)=>
				@user.first_name.should.equal "bobby"
				done()
			@UserController.updateUserSettings @req, @res

		it "should set the role", (done)->
			@req.body =
				role: "student"
			@res.send = (code)=>
				@user.role.should.equal "student"
				done()
			@UserController.updateUserSettings @req, @res

		it "should set the institution", (done)->
			@req.body =
				institution: "MIT"
			@res.send = (code)=>
				@user.institution.should.equal "MIT"
				done()
			@UserController.updateUserSettings @req, @res

		it "should set some props on ace", (done)->
			@req.body =
				theme: "something"
			@res.send = (code)=>
				@user.ace.theme.should.equal "something"
				done()
			@UserController.updateUserSettings @req, @res

		it "should send an error if the email is 0 len", (done)->
			@req.body.email = ""
			@res.send = (code)->
				code.should.equal 400
				done()
			@UserController.updateUserSettings @req, @res

		it "should send an error if the email does not contain an @", (done)->
			@req.body.email = "bob at something dot com"
			@res.send = (code)->
				code.should.equal 400
				done()
			@UserController.updateUserSettings @req, @res

		it "should call the user updater with the new email and user _id", (done)->
			@req.body.email = @newEmail.toUpperCase()
			@UserUpdater.changeEmailAddress.callsArgWith(2)
			@res.send = (code)=>
				code.should.equal 200
				@UserUpdater.changeEmailAddress.calledWith(@user_id, @newEmail).should.equal true
				done()
			@UserController.updateUserSettings @req, @res



	describe "logout", ->

		it "should destroy the session", (done)->

			@req.session.destroy = sinon.stub().callsArgWith(0)
			@res.redirect = (url)=>
				url.should.equal "/login"
				@req.session.destroy.called.should.equal true
				done()

			@UserController.logout @req, @res


	describe "register", ->
		beforeEach ->
			@req.body.email = @user.email = "email@example.com"
			@crypto.randomBytes = sinon.stub().returns({toString: () => @password = "mock-password"})
			@OneTimeTokenHandler.getNewToken.callsArgWith(2, null, @token = "mock-token")
		
		describe "with a new user", ->
			beforeEach ->
				@UserRegistrationHandler.registerNewUser.callsArgWith(1, null, @user)
				@UserController.register @req, @res
			
			it "should ask the UserRegistrationHandler to register user", ->
				@UserRegistrationHandler.registerNewUser
					.calledWith({
						email: @req.body.email
						password: @password
					}).should.equal true
					
			it "should generate a new password reset token", ->
				@OneTimeTokenHandler.getNewToken
					.calledWith(@user_id, expiresIn: 7 * 24 * 60 * 60)
					.should.equal true

			it "should send a registered email", ->
				@EmailHandler.sendEmail
					.calledWith("registered", {
						to: @user.email
						setNewPasswordUrl: "#{@settings.siteUrl}/user/password/set?passwordResetToken=#{@token}&email=#{encodeURIComponent(@user.email)}"
					})
					.should.equal true
			
			it "should return the user", ->
				@res.json
					.calledWith({
						email: @user.email
						setNewPasswordUrl: "#{@settings.siteUrl}/user/password/set?passwordResetToken=#{@token}&email=#{encodeURIComponent(@user.email)}"
					})
					.should.equal true

		describe "with a user that already exists", ->
			beforeEach ->
				@UserRegistrationHandler.registerNewUser.callsArgWith(1, new Error("EmailAlreadyRegistered"), @user)
				@UserController.register @req, @res
				
			it "should still generate a new password token and email", ->
				@OneTimeTokenHandler.getNewToken.called.should.equal true
				@EmailHandler.sendEmail.called.should.equal true

	describe "changePassword", ->

		it "should check the old password is the current one at the moment", (done)->
			@AuthenticationManager.authenticate.callsArgWith(2)
			@req.body =
				currentPassword: "oldpasshere"
			@res.send = =>
				@AuthenticationManager.authenticate.calledWith(_id:@user._id, "oldpasshere").should.equal true
				@AuthenticationManager.setUserPassword.called.should.equal false
				done()
			@UserController.changePassword @req, @res


		it "it should not set the new password if they do not match", (done)->
			@AuthenticationManager.authenticate.callsArgWith(2, null, {})
			@req.body =
				newPassword1: "1"
				newPassword2: "2"
			@res.send = =>
				@AuthenticationManager.setUserPassword.called.should.equal false
				done()
			@UserController.changePassword @req, @res			

		it "should set the new password if they do match", (done)->
			@AuthenticationManager.authenticate.callsArgWith(2, null, @user)
			@AuthenticationManager.setUserPassword.callsArgWith(2)
			@req.body =
				newPassword1: "newpass"
				newPassword2: "newpass"
			@res.send = =>
				@AuthenticationManager.setUserPassword.calledWith(@user._id, "newpass").should.equal true
				done()
			@UserController.changePassword @req, @res


