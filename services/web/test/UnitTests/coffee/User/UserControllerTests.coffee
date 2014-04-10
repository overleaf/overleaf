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
		@user =
			_id:"!@£!23123"
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

		@UserController = SandboxedModule.require modulePath, requires:
			"./UserLocator": @UserLocator
			"./UserDeleter": @UserDeleter
			"../../models/User": User:@User
			'../Newsletter/NewsletterManager':@NewsLetterManager
			"./UserRegistrationHandler":@UserRegistrationHandler
			"../Authentication/AuthenticationController": @AuthenticationController
			"logger-sharelatex": {log:->}


		@req = 
			session: destroy:->
			body:{}
		@res = {}
		@next = sinon.stub()
		@user_id = "323123"
		@req.session.user =
			_id = @user_id
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

		it "should set some props on ace", (done)->
			@req.body =
				theme: "something  "
			@res.send = (code)=>
				@user.ace.theme.should.equal "something"
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

			@UserRegistrationHandler.registerNewUser.callsArgWith(1, message:"EmailAlreadyRegisterd")
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
