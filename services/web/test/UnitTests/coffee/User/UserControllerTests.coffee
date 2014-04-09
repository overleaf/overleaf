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
		@UserDeleter = 
			deleteUser: sinon.stub().callsArgWith(1)
		@UserController = SandboxedModule.require modulePath, requires:
			"./UserGetter": @UserGetter = {}
			"./UserDeleter": @UserDeleter

		@req = new MockRequest()
		@res = new MockResponse()
		@next = sinon.stub()

	describe "getLoggedInUsersPersonalInfo", ->
		beforeEach ->
			@user =
				_id: ObjectId()
			@req.user = @user
			@UserController.sendFormattedPersonalInfo = sinon.stub()
			@UserController.getLoggedInUsersPersonalInfo(@req, @res, @next)

		it "should call sendFormattedPersonalInfo", ->
			@UserController.sendFormattedPersonalInfo
				.calledWith(@user, @res, @next)
				.should.equal true

	describe "getPersonalInfo", ->
		beforeEach ->
			@user_id = ObjectId().toString()
			@user =
				_id: ObjectId(@user_id)
			@req.params = user_id: @user_id

		describe "when the user exists", ->
			beforeEach ->
				@UserGetter.getUser = sinon.stub().callsArgWith(2, null, @user)
				@UserController.sendFormattedPersonalInfo = sinon.stub()
				@UserController.getPersonalInfo(@req, @res, @next)

			it "should look up the user in the database", ->
				@UserGetter.getUser
					.calledWith(@user_id, { _id: true, first_name: true, last_name: true, email: true })
					.should.equal true
				
			it "should send the formatted details back to the client", ->
				@UserController.sendFormattedPersonalInfo
					.calledWith(@user, @res, @next)
					.should.equal true

		describe "when the user does not exist", ->
			beforeEach ->
				@UserGetter.getUser = sinon.stub().callsArgWith(2, null, null)
				@UserController.sendFormattedPersonalInfo = sinon.stub()
				@UserController.getPersonalInfo(@req, @res, @next)

			it "should return 404 to the client", ->
				@res.statusCode.should.equal 404

	describe "sendFormattedPersonalInfo", ->
		beforeEach ->
			@user =
				_id: ObjectId()
				first_name: "Douglas"
				last_name: "Adams"
				email: "doug@sharelatex.com"
			@formattedInfo =
				id: @user._id.toString()
				first_name: @user.first_name
				last_name: @user.last_name
				email: @user.email
			@UserController._formatPersonalInfo = sinon.stub().callsArgWith(1, null, @formattedInfo)
			@UserController.sendFormattedPersonalInfo @user, @res

		it "should format the user details for the response", ->
			@UserController._formatPersonalInfo
				.calledWith(@user)
				.should.equal true

		it "should send the formatted details back to the client", ->
			@res.body.should.equal JSON.stringify(@formattedInfo)

	describe "_formatPersonalInfo", ->
		it "should return the correctly formatted data", ->
			@user =
				_id: ObjectId()
				first_name: "Douglas"
				last_name: "Adams"
				email: "doug@sharelatex.com"
				password: "should-not-get-included"
				signUpDate: new Date()
			@UserController._formatPersonalInfo @user, (error, info) =>
				expect(info).to.deep.equal {
					id: @user._id.toString()
					first_name: @user.first_name
					last_name: @user.last_name
					email: @user.email
					signUpDate: @user.signUpDate
				}


	describe "deleteUser", ->

		it "should delete the user", (done)->
			user_id = "323123"
			@req.session.user =
				_id = user_id
			@res.send = (code)=>
				@UserDeleter.deleteUser.calledWith(user_id)
				code.should.equal 200
				done()
			@UserController.deleteUser @req, @res






