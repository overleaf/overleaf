sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Authentication/AuthenticationManager.js"
SandboxedModule = require('sandboxed-module')
events = require "events"
ObjectId = require("mongojs").ObjectId
Errors = require "../../../../app/js/Features/Errors/Errors"

describe "AuthenticationManager", ->
	beforeEach ->
		@settings = { security: { bcryptRounds: 12 } }
		@AuthenticationManager = SandboxedModule.require modulePath, requires:
			"../../models/User": User: @User = {}
			"../../infrastructure/mongojs":
				db: @db =
					users: {}
				ObjectId: ObjectId
			"bcrypt": @bcrypt = {}
			"settings-sharelatex": @settings
			"../V1/V1Handler": @V1Handler = {}
			"../User/UserGetter": @UserGetter = {}
		@callback = sinon.stub()

	describe "with real bcrypt", ->
		beforeEach ->
			bcrypt = require('bcrypt')
			@bcrypt.compare = bcrypt.compare
			@bcrypt.getRounds = bcrypt.getRounds
			@bcrypt.genSalt = bcrypt.genSalt
			@bcrypt.hash = bcrypt.hash
			# Hash of 'testpassword'
			@testPassword = '$2a$12$zhtThy3R5tLtw5sCwr5XD.zhPENGn4ecjeMcP87oYSYrIICFqBpei'

		describe "authenticate", ->
			beforeEach ->
				@user =
					_id: "user-id"
					email: @email = "USER@sharelatex.com"
				@User.findOne = sinon.stub().callsArgWith(1, null, @user)

			describe "when the hashed password matches", ->
				beforeEach (done) ->
					@unencryptedPassword = "testpassword"
					@user.hashedPassword = @testPassword
					@AuthenticationManager.authenticate email: @email, @unencryptedPassword, (error, user) =>
						@callback(error, user)
						done()

				it "should look up the correct user in the database", ->
					@User.findOne.calledWith(email: @email).should.equal true

				it "should return the user", ->
					@callback.calledWith(null, @user).should.equal true

			describe "when the encrypted passwords do not match", ->
				beforeEach ->
					@AuthenticationManager.authenticate(email: @email, "notthecorrectpassword", @callback)

				it "should not return the user", ->
					@callback.calledWith(null, null).should.equal true

		describe "setUserPasswordInV2", ->
			beforeEach ->
				@user =
					_id: "5c8791477192a80b5e76ca7e"
					email: @email = "USER@sharelatex.com"
				@db.users.update = sinon.stub().callsArgWith(2, null, {nModified: 1})

			it "should not produce an error", (done) ->
				@AuthenticationManager.setUserPasswordInV2 @user._id, "testpassword", (err, updated) =>
					expect(err).to.not.exist
					expect(updated).to.equal true
					done()

			it "should set the hashed password", (done) ->
				@AuthenticationManager.setUserPasswordInV2 @user._id, "testpassword", (err, updated) =>
					expect(err).to.not.exist
					hashedPassword = @db.users.update.lastCall.args[1].$set.hashedPassword
					expect(hashedPassword).to.exist
					expect(hashedPassword.length).to.equal 60
					expect(hashedPassword).to.match /^\$2a\$12\$[a-zA-Z0-9\/.]{53}$/
					done()

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
					@bcrypt.getRounds = sinon.stub().returns 12
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
					@AuthenticationManager.authenticate(email: @email, @unencryptedPassword, @callback)

				it "should not return the user", ->
					@callback.calledWith(null, null).should.equal true

			describe "when the hashed password matches but the number of rounds is too low", ->
				beforeEach (done) ->
					@user.hashedPassword = @hashedPassword = "asdfjadflasdf"
					@bcrypt.compare = sinon.stub().callsArgWith(2, null, true)
					@bcrypt.getRounds = sinon.stub().returns 7
					@AuthenticationManager.setUserPassword = sinon.stub().callsArgWith(2, null)
					@AuthenticationManager.authenticate email: @email, @unencryptedPassword, (error, user) =>
						@callback(error, user)
						done()

				it "should look up the correct user in the database", ->
					@User.findOne.calledWith(email: @email).should.equal true

				it "should check that the passwords match", ->
					@bcrypt.compare
						.calledWith(@unencryptedPassword, @hashedPassword)
						.should.equal true

				it "should check the number of rounds", ->
					@bcrypt.getRounds.called.should.equal true

				it "should set the users password (with a higher number of rounds)", ->
					@AuthenticationManager.setUserPassword
						.calledWith("user-id", @unencryptedPassword)
						.should.equal true

				it "should return the user", ->
					@callback.calledWith(null, @user).should.equal true

		describe "when the user does not exist in the database", ->
			beforeEach ->
				@User.findOne = sinon.stub().callsArgWith(1, null, null)
				@AuthenticationManager.authenticate(email: @email, @unencrpytedPassword, @callback)

			it "should not return a user", ->
				@callback.calledWith(null, null).should.equal true

	describe "validateEmail", ->
		describe "valid", ->
			it "should return null", ->
				result = @AuthenticationManager.validateEmail 'foo@example.com'
				expect(result).to.equal null

		describe "invalid", ->
			it "should return validation error object for no email", ->
				result = @AuthenticationManager.validateEmail ''
				expect(result).to.not.equal null
				expect(result.message).to.equal 'email not valid'

			it "should return validation error object for invalid", ->
				result = @AuthenticationManager.validateEmail 'notanemail'
				expect(result).to.not.equal null
				expect(result.message).to.equal 'email not valid'

	describe "validatePassword", ->
		beforeEach ->
			# 73 characters:
			@longPassword = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012345678'

		describe "with a null password", ->
			it "should return an error", ->
				expect(@AuthenticationManager.validatePassword()).to.eql { message: 'password not set' }

		describe "password length", ->
			describe "with the default password length options", ->
				it "should reject passwords that are too short", ->
					expect(@AuthenticationManager.validatePassword('')).to.eql { message: 'password is too short' }
					expect(@AuthenticationManager.validatePassword('foo')).to.eql { message: 'password is too short' }

				it "should reject passwords that are too long", ->
					expect(@AuthenticationManager.validatePassword(@longPassword)).to.eql { message: 'password is too long' }

				it "should accept passwords that are a good length", ->
					expect(@AuthenticationManager.validatePassword('l337h4x0r')).to.equal null

			describe "when the password length is specified in settings", ->
				beforeEach ->
					@settings.passwordStrengthOptions =
						length:
							min: 10
							max: 12

				it "should reject passwords that are too short", ->
					expect(@AuthenticationManager.validatePassword('012345678')).to.eql { message: 'password is too short' }

				it "should accept passwords of exactly minimum length", ->
					expect(@AuthenticationManager.validatePassword('0123456789')).to.equal null

				it "should reject passwords that are too long", ->
					expect(@AuthenticationManager.validatePassword('0123456789abc')).to.eql { message: 'password is too long' }

				it "should accept passwords of exactly maximum length", ->
					expect(@AuthenticationManager.validatePassword('0123456789ab')).to.equal null

			describe "when the maximum password length is set to >72 characters in settings", ->
				beforeEach ->
					@settings.passwordStrengthOptions =
						length:
							max: 128

				it "should still reject passwords > 72 characters in length", ->
					expect(@AuthenticationManager.validatePassword(@longPassword)).to.eql { message: 'password is too long' }

		describe "allowed characters", ->
			describe "with the default settings for allowed characters", ->
				it "should allow passwords with valid characters", ->
					expect(@AuthenticationManager.validatePassword("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")).to.equal null
					expect(@AuthenticationManager.validatePassword("1234567890@#$%^&*()-_=+[]{};:<>/?!£€.,")).to.equal null

				it "should not allow passwords with invalid characters", ->
					expect(@AuthenticationManager.validatePassword("correct horse battery staple")).to.eql { message: 'password contains an invalid character' }

			describe "when valid characters are overridden in settings", ->
				beforeEach ->
					@settings.passwordStrengthOptions =
						chars:
							symbols: " "

				it "should allow passwords with valid characters", ->
					expect(@AuthenticationManager.validatePassword("correct horse battery staple")).to.equal null

				it "should disallow passwords with invalid characters", ->
					expect(@AuthenticationManager.validatePassword("1234567890@#$%^&*()-_=+[]{};:<>/?!£€.,")).to.eql { message: 'password contains an invalid character' }

			describe "when allowAnyChars is set", ->
				beforeEach ->
					@settings.passwordStrengthOptions =
						allowAnyChars: true

				it "should allow any characters", ->
					expect(@AuthenticationManager.validatePassword("correct horse battery staple")).to.equal null
					expect(@AuthenticationManager.validatePassword("1234567890@#$%^&*()-_=+[]{};:<>/?!£€.,")).to.equal null

	describe "setUserPassword", ->
		beforeEach ->
			@user_id = ObjectId()
			@password = "banana"
			@hashedPassword = "asdkjfa;osiuvandf"
			@salt = "saltaasdfasdfasdf"
			@bcrypt.genSalt = sinon.stub().callsArgWith(2, null, @salt)
			@bcrypt.hash = sinon.stub().callsArgWith(2, null, @hashedPassword)
			@db.users.update = sinon.stub().callsArg(2)

		describe "too long", ->
			beforeEach ->
				@settings.passwordStrengthOptions =
					length:
						max:10
				@password = "dsdsadsadsadsadsadkjsadjsadjsadljs"

			it "should return and error", (done)->
				@AuthenticationManager.setUserPassword @user_id, @password, (err)->
					expect(err).to.exist
					done()

			it "should not start the bcrypt process", (done)->
				@AuthenticationManager.setUserPassword @user_id, @password, (err)=>
					@bcrypt.genSalt.called.should.equal false
					@bcrypt.hash.called.should.equal false
					done()

		describe "too short", ->
			beforeEach ->
				@settings.passwordStrengthOptions =
					length:
						max:10
						min:6
				@password = "dsd"

			it "should return and error", (done)->
				@AuthenticationManager.setUserPassword @user_id, @password, (err)->
					expect(err).to.exist
					done()

			it "should not start the bcrypt process", (done)->
				@AuthenticationManager.setUserPassword @user_id, @password, (err)=>
					@bcrypt.genSalt.called.should.equal false
					@bcrypt.hash.called.should.equal false
					done()

		describe "password set attempt", ->
			describe "with SL user in SL", ->
				beforeEach ->
					@UserGetter.getUser = sinon.stub().yields(null, { overleaf: null })
					@AuthenticationManager.setUserPassword(@user_id, @password, @callback)

				it 'should look up the user', ->
					@UserGetter.getUser.calledWith(@user_id).should.equal true

				it "should update the user's password in the database", ->
					args = @db.users.update.lastCall.args
					expect(args[0]).to.deep.equal {_id: ObjectId(@user_id.toString())}
					expect(args[1]).to.deep.equal {
						$set: {
							"hashedPassword": @hashedPassword
						}
						$unset: password: true
					}

				it "should hash the password", ->
					@bcrypt.genSalt
						.calledWith(12)
						.should.equal true
					@bcrypt.hash
						.calledWith(@password, @salt)
						.should.equal true

				it "should call the callback", ->
					@callback.called.should.equal true

			describe "with SL user in v2", ->
				beforeEach (done) ->
					@settings.overleaf = true
					@UserGetter.getUser = sinon.stub().yields(null, { overleaf: null })
					@AuthenticationManager.setUserPassword @user_id, @password, (err, changed) =>
						@callback(err, changed)
						done()
				it "should error", ->
					@callback.calledWith(new Errors.SLInV2Error("Password Reset Attempt")).should.equal true

			describe "with v2 user in SL", ->
				beforeEach (done) ->
					@UserGetter.getUser = sinon.stub().yields(null, { overleaf: {id: 1} })
					@AuthenticationManager.setUserPassword @user_id, @password, (err, changed) =>
						@callback(err, changed)
						done()
				it "should error", ->
					@callback.calledWith(new Errors.NotInV2Error("Password Reset Attempt")).should.equal true

			describe "with v2 user in v2", ->
				beforeEach (done) ->
					@settings.overleaf = true
					@UserGetter.getUser = sinon.stub().yields(null, { overleaf: {id: 1} })
					@V1Handler.doPasswordReset = sinon.stub().yields(null, true)
					@AuthenticationManager.setUserPassword @user_id, @password, (err, changed) =>
						@callback(err, changed)
						done()
				it "should set the password in v2", ->
					@callback.calledWith(null, true).should.equal true
