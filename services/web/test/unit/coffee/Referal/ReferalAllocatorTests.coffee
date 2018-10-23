SandboxedModule = require('sandboxed-module')
assert = require('assert')
require('chai').should()
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Referal/ReferalAllocator.js'

describe 'ReferalAllocator', ->

	beforeEach ->
		@ReferalAllocator = SandboxedModule.require modulePath, requires:
			'../../models/User': User: @User = {}
			"../Subscription/FeaturesUpdater": @FeaturesUpdater = {}
			"settings-sharelatex": @Settings = {}
			'logger-sharelatex':
				log:->
				err:->
		@callback = sinon.stub()
		@referal_id = "referal-id-123"
		@referal_medium = "twitter"
		@user_id = "user-id-123"
		@new_user_id = "new-user-id-123"
		@FeaturesUpdater.refreshFeatures = sinon.stub().yields()
		@User.update = sinon.stub().callsArgWith 3, null
		@User.findOne = sinon.stub().callsArgWith 1, null, { _id: @user_id }

	describe "allocate", ->
		describe "when the referal was a bonus referal", ->
			beforeEach ->
				@referal_source = "bonus"
				@ReferalAllocator.allocate @referal_id, @new_user_id, @referal_source, @referal_medium, @callback

			it 'should update the referring user with the refered users id', ->
				@User.update.calledWith({
					"referal_id":@referal_id
				}, {
					$push:
						refered_users: @new_user_id
					$inc:
						refered_user_count: 1
				}).should.equal true

			it "find the referring users id", ->
				@User.findOne
					.calledWith( referal_id: @referal_id )
					.should.equal true

			it "should refresh the user's subscription", ->
				@FeaturesUpdater.refreshFeatures
					.calledWith(@user_id)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when there is no user for the referal id", ->
			beforeEach ->
				@referal_source = "bonus"
				@referal_id = "wombat"
				@User.findOne = sinon.stub().callsArgWith 1, null, null
				@ReferalAllocator.allocate @referal_id, @new_user_id, @referal_source, @referal_medium, @callback

			it "should find the referring users id", ->
				@User.findOne
					.calledWith( referal_id: @referal_id )
					.should.equal true

			it 'should not update the referring user with the refered users id', ->
				@User.update.called.should.equal false

			it "should not assign the user a bonus", ->
				@FeaturesUpdater.refreshFeatures.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true


		describe "when the referal is not a bonus referal", ->
			beforeEach ->
				@referal_source = "public_share"
				@ReferalAllocator.allocate @referal_id, @new_user_id, @referal_source, @referal_medium, @callback

			it 'should not update the referring user with the refered users id', ->
				@User.update.called.should.equal false

			it "find the referring users id", ->
				@User.findOne
					.calledWith( referal_id: @referal_id )
					.should.equal true

			it "should not assign the user a bonus", ->
				@FeaturesUpdater.refreshFeatures.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true
