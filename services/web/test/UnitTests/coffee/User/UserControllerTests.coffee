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
		@UserController = SandboxedModule.require modulePath, requires:
			"./UserLocator": @UserLocator
			"./UserDeleter": @UserDeleter
			"../../models/User": User:@User
			'../Newsletter/NewsletterManager':@NewsLetterManager
			"logger-sharelatex": {log:->}


		@req = new MockRequest()
		@res = new MockResponse()
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

			@req.session.destroy = (cb)-> 
				if cb?
					cb()
			@res.redirect = (url)=>
				url.should.equal "/login"
				@req.session.destroy.called.should.equal true
				done()

			@UserController.logout @req, @res


