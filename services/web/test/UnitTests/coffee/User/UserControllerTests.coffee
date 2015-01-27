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
		@AuthenticationController = {}
		@AuthenticationManager =
			authenticate: sinon.stub()
			setUserPassword: sinon.stub()
		@ReferalAllocator =
			allocate:sinon.stub()
		@SubscriptionDomainAllocator = 
			autoAllocate:sinon.stub()
		@UserUpdater =
			changeEmailAddress:sinon.stub()
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
			"../Subscription/SubscriptionDomainAllocator":@SubscriptionDomainAllocator
			"logger-sharelatex": {log:->}


		@req = 
			session: 
				destroy:->
				user :
					_id : @user_id
			body:{}
		@res = {}
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

		it "should ask the UserRegistrationHandler to register user", (done)->
			@UserRegistrationHandler.registerNewUser.callsArgWith(1, null, @user)
			@res.send = =>
				@UserRegistrationHandler.registerNewUser.calledWith(@req.body).should.equal true
				done()
			@UserController.register @req, @res

		it "should try and log the user in if there is an EmailAlreadyRegisterd error", (done)->

			@UserRegistrationHandler.registerNewUser.callsArgWith(1, "EmailAlreadyRegisterd")
			@AuthenticationController.login = (req, res)=>
				assert.deepEqual req, @req
				assert.deepEqual res, @res
				done()
			@UserController.register @req, @res

		it "should put the user on the session and mark them as justRegistered", (done)->
			@UserRegistrationHandler.registerNewUser.callsArgWith(1, null, @user)
			@res.send = =>
				assert.deepEqual @user, @req.session.user
				assert.equal @req.session.justRegistered, true
				done()
			@UserController.register @req, @res

		it "should redirect to project page", (done)->
			@UserRegistrationHandler.registerNewUser.callsArgWith(1, null, @user)
			@res.send = (opts)=>
				opts.redir.should.equal "/project"
				done()
			@UserController.register @req, @res			


		it "should redirect passed redir if it exists", (done)->
			@UserRegistrationHandler.registerNewUser.callsArgWith(1, null, @user)
			@req.body.redir = "/somewhere"
			@res.send = (opts)=>
				opts.redir.should.equal "/somewhere"
				done()
			@UserController.register @req, @res

		it "should allocate the referals", (done)->
			@req.session =
				referal_id : "23123"
				referal_source : "email"
				referal_medium : "bob"
				
			@UserRegistrationHandler.registerNewUser.callsArgWith(1, null, @user)
			@req.body.redir = "/somewhere"
			@res.send = (opts)=>
				@ReferalAllocator.allocate.calledWith(@req.session.referal_id, @user._id, @req.session.referal_source, @req.session.referal_medium).should.equal true
				done()
			@UserController.register @req, @res			
			
		it "should auto allocate the subscription for that domain", (done)->
			@UserRegistrationHandler.registerNewUser.callsArgWith(1, null, @user)
			@res.send = (opts)=>
				@SubscriptionDomainAllocator.autoAllocate.calledWith(@user).should.equal true
				done()
			@UserController.register @req, @res		


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


