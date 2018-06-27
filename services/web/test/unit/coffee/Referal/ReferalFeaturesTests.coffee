SandboxedModule = require('sandboxed-module')
assert = require('assert')
require('chai').should()
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Referal/ReferalFeatures.js'

describe 'ReferalFeatures', ->

	beforeEach ->
		@ReferalFeatures = SandboxedModule.require modulePath, requires:
			'../User/UserGetter': @UserGetter = {}
			"settings-sharelatex": @Settings = {}
			'logger-sharelatex':
				log:->
				err:->
		@callback = sinon.stub()
		@referal_id = "referal-id-123"
		@referal_medium = "twitter"
		@user_id = "user-id-123"
		@new_user_id = "new-user-id-123"

	describe "getBonusFeatures", ->
			beforeEach ->
				@refered_user_count = 3
				@Settings.bonus_features =
					"3":
						collaborators: 3
						dropbox: false
						versioning: false
				stubbedUser = {
					refered_user_count: @refered_user_count,
					features:{collaborators:1, dropbox:false, versioning:false}
				}

				@UserGetter.getUserOrUserStubById = sinon.stub().yields null, stubbedUser
				@ReferalFeatures.getBonusFeatures @user_id, @callback

			it "should get the users number of refered user", ->
				@UserGetter.getUserOrUserStubById
					.calledWith(@user_id, null)
					.should.equal true

			it "should call the callback with the features", ->
				@callback.calledWith(null, @Settings.bonus_features[3]).should.equal true

		describe "when the user is not at a bonus level", ->
			beforeEach ->
				@refered_user_count = 0
				@Settings.bonus_features =
					"1":
						collaborators: 3
						dropbox: false
						versioning: false
				@UserGetter.getUserOrUserStubById =
					sinon.stub().yields null, { refered_user_count: @refered_user_count }
				@ReferalFeatures.getBonusFeatures @user_id, @callback

			it "should get the users number of refered user", ->
				@UserGetter.getUserOrUserStubById
					.calledWith(@user_id, null)
					.should.equal true

			it "should call the callback with no features", ->
				@callback.calledWith(null, {}).should.equal true
