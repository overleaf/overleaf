sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Authentication/AuthenticationManager.js"
SandboxedModule = require('sandboxed-module')
events = require "events"
ObjectId = require("mongojs").ObjectId

describe "AuthenticationManager", ->
	beforeEach ->
		@AuthenticationManager = SandboxedModule.require modulePath, requires:
			"../../models/User": User: @User = {}
			"../../infrastructure/mongojs":
				db: @db =
					users: {}
				ObjectId: ObjectId
			"bcrypt": @bcrypt = {}
		@callback = sinon.stub()

	describe "authenticate", ->
		describe "when the user exists in the database", ->
			beforeEach ->
				@user =
					_id: "user-id"
					email: @email = "USER@sharelatex.com"
				@unencryptedPassword = "banana"
				@User.findOne = sinon.stub().callsArgWith(1, null, @user)
		
			describe "when the hashed password matches", ->
				beforeEach (done) ->
					@user.hashedPassword = @hashedPassword = "asdfjadflasdf"
					@bcrypt.compare = sinon.stub().callsArgWith(2, null, true)
					@AuthenticationManager.authenticate email: @email, @unencryptedPassword, (error, user) =>
						@callback(error, user)
						done()

				it "should look up the correct user in the database", ->
					@User.findOne.calledWith(email: @email).should.equal true

				it "should check that the passwords match", ->
					@bcrypt.compare
						.calledWith(@unencryptedPassword, @hashedPassword)
						.should.equal true

				it "should return the user", ->
					@callback.calledWith(null, @user).should.equal true

			describe "when the encrypted passwords do not match", ->
				beforeEach ->
					@AuthenticationManager._encryptPassword = sinon.stub().returns("Not the encrypted password")
					@AuthenticationManager.authenticate(email: @email, @unencryptedPassword, @callback)

				it "should not return the user", ->
					@callback.calledWith(null, null).should.equal true

		describe "when the user does not exist in the database", ->
			beforeEach ->
				@User.findOne = sinon.stub().callsArgWith(1, null, null)
				@AuthenticationManager.authenticate(email: @email, @unencrpytedPassword, @callback)

			it "should not return a user", ->
				@callback.calledWith(null, null).should.equal true

	describe "setUserPassword", ->
		beforeEach ->
			@user_id = ObjectId()
			@password = "banana"
			@hashedPassword = "asdkjfa;osiuvandf"
			@salt = "saltaasdfasdfasdf"
			@bcrypt.genSalt = sinon.stub().callsArgWith(1, null, @salt)
			@bcrypt.hash = sinon.stub().callsArgWith(2, null, @hashedPassword)
			@db.users.update = sinon.stub().callsArg(2)
			@AuthenticationManager.setUserPassword(@user_id, @password, @callback)

		it "should update the user's password in the database", ->
			@db.users.update
				.calledWith({
					_id: ObjectId(@user_id.toString())
				}, {
					$set: {
						"hashedPassword": @hashedPassword
					}
					$unset: password: true
				})
				.should.equal true

		it "should hash the password", ->
			@bcrypt.genSalt
				.calledWith(7)
				.should.equal true
			@bcrypt.hash
				.calledWith(@password, @salt)
				.should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

	describe "getAuthToken", ->
		beforeEach ->
			@auth_token = "auth-token"

		describe "when the user has an auth token set", ->
			beforeEach ->
				@db.users.findOne = sinon.stub().callsArgWith(2, null, auth_token: @auth_token)
				@AuthenticationManager.getAuthToken(@user_id, @callback)

			it "should look up the auth token in the db", ->
				@db.users.findOne
					.calledWith({
						_id: ObjectId(@user_id.toString())
					}, {
						auth_token: true
					})
					.should.equal true

			it "should return the auth token", ->
				@callback.calledWith(null, @auth_token).should.equal true

		describe "when the user does not have an auth token set", ->
			beforeEach ->
				@db.users.findOne = sinon.stub().callsArgWith(2, null, auth_token: null)
				@db.users.update = sinon.stub().callsArgWith(2, null)
				@AuthenticationManager._createSecureToken = sinon.stub().callsArgWith(0, null, @auth_token)
				@AuthenticationManager.getAuthToken(@user_id, @callback)

			it "should generate a new auth token", ->
				@AuthenticationManager._createSecureToken.called.should.equal true

			it "should set the auth token on the user document in the db", ->
				@db.users.update
					.calledWith({
						_id: ObjectId(@user_id.toString())
					}, {
						$set: auth_token: @auth_token
					})
					.should.equal true
			
			it "should return the auth token", ->
				@callback.calledWith(null, @auth_token).should.equal true
			


