Errors = require "../../../app/js/Features/Errors/Errors"
Settings = require "settings-sharelatex"
User = require "./helpers/User"
ThirdPartyIdentityManager = require "../../../app/js/Features/User/ThirdPartyIdentityManager"
chai = require "chai"

expect = chai.expect

describe "ThirdPartyIdentityManager", ->
	beforeEach (done) ->
		@provider = "provider"
		@externalUserId = "external-user-id"
		@externalData = test: "data"
		@user = new User()
		@user.ensureUserExists done

	afterEach (done) ->
		@user.full_delete_user @user.email, done

	describe "login", ->
		describe "when third party identity exists", ->
			beforeEach (done) ->
				ThirdPartyIdentityManager.link @user.id, @provider, @externalUserId, @externalData, done

			it "should return user", (done) ->
				ThirdPartyIdentityManager.login @provider, @externalUserId, @externalData, (err, user) =>
					expect(err).to.be.null
					expect(user._id.toString()).to.equal @user.id
					done()
				return

			it "should merge external data", (done) ->
				@externalData =
					test: "different"
					another: "key"
				ThirdPartyIdentityManager.login @provider, @externalUserId, @externalData, (err, user) =>
					expect(err).to.be.null
					expect(user.thirdPartyIdentifiers[0].externalData).to.deep.equal @externalData
					done()
				return

		describe "when third party identity does not exists", ->
			it "should return error", (done) ->
				ThirdPartyIdentityManager.login @provider, @externalUserId, @externalData, (err, user) =>
					expect(err.name).to.equal "ThirdPartyUserNotFoundError"
					done()
				return

	describe "link", ->
		describe "when provider not already linked", ->
			it "should link provider to user", (done) ->
				ThirdPartyIdentityManager.link @user.id, @provider, @externalUserId, @externalData, (err, res) ->
					expect(res.nModified).to.equal 1
					done()

		describe "when provider is already linked", ->
			beforeEach (done) ->
				ThirdPartyIdentityManager.link @user.id, @provider, @externalUserId, @externalData, done

			it "should link provider to user", (done) ->
				ThirdPartyIdentityManager.link @user.id, @provider, @externalUserId, @externalData, (err, res) ->
					expect(res.nModified).to.equal 1
					done()

			it "should not create duplicate thirdPartyIdentifiers", (done) ->
				ThirdPartyIdentityManager.link @user.id, @provider, @externalUserId, @externalData, (err, res) =>
					@user.get (err, user) ->
						expect(user.thirdPartyIdentifiers.length).to.equal 1
						done()

			it "should replace existing data", (done) ->
				@externalData = replace: "data"
				ThirdPartyIdentityManager.link @user.id, @provider, @externalUserId, @externalData, (err, res) =>
					@user.get (err, user) =>
						expect(user.thirdPartyIdentifiers[0].externalData).to.deep.equal @externalData
						done()

	describe "unlink", ->
		describe "when provider not already linked", ->
			it "should succeed", (done) ->
				ThirdPartyIdentityManager.unlink @user.id, @provider, (err, res) ->
					expect(err).to.be.null
					expect(res.nModified).to.equal 0
					done()

		describe "when provider is already linked", ->
			beforeEach (done) ->
				ThirdPartyIdentityManager.link @user.id, @provider, @externalUserId, @externalData, done

			it "should remove thirdPartyIdentifiers entry", (done) ->
				ThirdPartyIdentityManager.unlink @user.id, @provider, (err, res) =>
					@user.get (err, user) ->
						expect(user.thirdPartyIdentifiers.length).to.equal 0
						done()
