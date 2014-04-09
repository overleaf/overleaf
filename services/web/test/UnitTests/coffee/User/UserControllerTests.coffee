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

		@UserDeleter = 
			deleteUser: sinon.stub().callsArgWith(1)
		@UserLocator =
			findById: sinon.stub().callsArgWith(1, null, @user)
		@NewsLetterManager =
			unsubscribe: sinon.stub().callsArgWith(1)
		@UserController = SandboxedModule.require modulePath, requires:
			"./UserDeleter": @UserDeleter
			"./UserLocator": @UserLocator
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



